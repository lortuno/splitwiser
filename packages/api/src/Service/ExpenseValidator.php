<?php

declare(strict_types=1);

namespace App\Service;

use App\Dto\NewExpense;
use App\Dto\SplitEntry;
use App\Dto\SplitType;
use App\Money;

/**
 * Turns a raw request body into a NewExpense or throws ValidationException.
 * Error keys match the form fields: name, date, amount_cents, recorded_by,
 * paid_by, paid_by.<person_id>, split, split.<person_id>.
 */
final class ExpenseValidator
{
    public const int MAX_AMOUNT_CENTS = 100_000_000;
    public const int PERCENT_TOTAL_BASIS_POINTS = 10_000;
    public const int MAX_SHARE_UNITS = 1_000;

    /** @var array<string, array{code: string, message: string}> */
    private array $errors = [];

    /** @param list<int> $memberIds */
    public function validate(array $input, array $memberIds): NewExpense
    {
        $this->errors = [];

        $name = $this->name($input['name'] ?? null);
        $date = $this->date($input['date'] ?? null);
        $amount = $this->amount($input['amount_cents'] ?? null);
        $recordedBy = $this->member('recorded_by', $input['recorded_by'] ?? null, $memberIds);
        $paidBy = $this->paidBy($input['paid_by'] ?? null, $memberIds, $amount);
        [$splitType, $splitBetween] = $this->split($input['split'] ?? null, $memberIds, $amount);

        if ($this->errors !== []) {
            throw new ValidationException($this->errors);
        }

        return new NewExpense($name, $date, $amount, $recordedBy, $paidBy, $splitType, $splitBetween);
    }

    private function name(mixed $value): string
    {
        $name = is_string($value) ? trim($value) : '';
        if ($name === '') {
            $this->fail('name', 'required', 'Enter a name for the expense.');
        } elseif (mb_strlen($name) > 120) {
            $this->fail('name', 'too_long', 'Use at most 120 characters.');
        }

        return $name;
    }

    private function date(mixed $value): string
    {
        $valid = is_string($value)
            && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m) === 1
            && checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
        if (!$valid) {
            $this->fail('date', 'invalid_date', 'Enter a date as YYYY-MM-DD.');
        }

        return is_string($value) ? $value : '';
    }

    private function amount(mixed $value): int
    {
        if (!is_int($value) || $value <= 0) {
            $this->fail('amount_cents', 'invalid_amount', 'Enter an amount greater than 0.');
            return 0;
        }
        if ($value > self::MAX_AMOUNT_CENTS) {
            $this->fail('amount_cents', 'too_large', 'The amount is too large.');
            return 0;
        }

        return $value;
    }

    /** @param list<int> $memberIds */
    private function member(string $field, mixed $value, array $memberIds): int
    {
        if (!is_int($value)) {
            $this->fail($field, 'required', 'Choose a person.');
            return 0;
        }
        if (!in_array($value, $memberIds, true)) {
            $this->fail($field, 'not_a_member', 'This person is not on the trip.');
        }

        return $value;
    }

    /**
     * @param list<int> $memberIds
     * @return array<int, int> person id => cents
     */
    private function paidBy(mixed $value, array $memberIds, int $amount): array
    {
        if (!is_array($value) || $value === []) {
            $this->fail('paid_by', 'required', 'Choose who paid.');
            return [];
        }

        $paidBy = [];
        foreach ($value as $entry) {
            $personId = $this->entryPersonId('paid_by', $entry, $memberIds, $paidBy);
            if ($personId === null) {
                continue;
            }
            $cents = $entry['amount_cents'] ?? null;
            if (!is_int($cents) || $cents <= 0) {
                $this->fail("paid_by.{$personId}", 'invalid_amount', 'Enter an amount greater than 0.');
                $cents = 0;
            }
            $paidBy[$personId] = $cents;
        }

        if ($amount > 0 && !isset($this->errors['paid_by']) && array_sum($paidBy) !== $amount) {
            $this->fail('paid_by', 'sum_mismatch', sprintf(
                'Paid amounts add up to %s but the expense is %s.',
                Money::format(array_sum($paidBy)),
                Money::format($amount),
            ));
        }
        ksort($paidBy);

        return $paidBy;
    }

    /**
     * @param list<int> $memberIds
     * @return array{SplitType, list<SplitEntry>}
     */
    private function split(mixed $value, array $memberIds, int $amount): array
    {
        $type = is_array($value) ? SplitType::tryFrom((string) ($value['type'] ?? '')) : null;
        if ($type === null) {
            $this->fail('split', 'invalid_type', 'Choose how to split: equal, exact, percentage or shares.');
            return [SplitType::Equal, []];
        }
        $between = $value['between'] ?? null;
        if (!is_array($between) || $between === []) {
            $this->fail('split', 'required', 'Choose who shares this expense.');
            return [$type, []];
        }

        $entries = [];
        foreach ($between as $entry) {
            $personId = $this->entryPersonId('split', $entry, $memberIds, $entries);
            if ($personId === null) {
                continue;
            }
            $entries[$personId] = new SplitEntry($personId, $this->splitValue($type, $personId, $entry['value'] ?? null));
        }
        ksort($entries);
        $entries = array_values($entries);

        if ($this->hasErrorsFor('split')) {
            return [$type, $entries];
        }
        $sum = array_sum(array_map(static fn (SplitEntry $e): int => (int) $e->value, $entries));
        if ($type === SplitType::Exact && $amount > 0 && $sum !== $amount) {
            $this->fail('split', 'sum_mismatch', sprintf(
                'Split amounts add up to %s but the expense is %s.',
                Money::format($sum),
                Money::format($amount),
            ));
        }
        if ($type === SplitType::Percentage && $sum !== self::PERCENT_TOTAL_BASIS_POINTS) {
            $this->fail('split', 'sum_mismatch', sprintf(
                'Percentages add up to %s %% instead of 100,00 %%.',
                number_format($sum / 100, 2, ',', '.'),
            ));
        }

        return [$type, $entries];
    }

    private function splitValue(SplitType $type, int $personId, mixed $value): ?int
    {
        [$valid, $message] = match ($type) {
            SplitType::Equal => [true, ''],
            SplitType::Exact => [is_int($value) && $value > 0, 'Enter an amount greater than 0.'],
            SplitType::Percentage => [
                is_int($value) && $value > 0 && $value <= self::PERCENT_TOTAL_BASIS_POINTS,
                'Enter a percentage between 0,01 and 100.',
            ],
            SplitType::Shares => [
                is_int($value) && $value >= 1 && $value <= self::MAX_SHARE_UNITS,
                'Enter a whole number of shares from 1 to 1000.',
            ],
        };
        if (!$valid) {
            $this->fail("split.{$personId}", 'invalid_value', $message);
            return null;
        }

        return $type === SplitType::Equal ? null : $value;
    }

    /**
     * Validates the person_id of a list entry; returns null (after recording an error) when unusable.
     * @param list<int> $memberIds
     */
    private function entryPersonId(string $field, mixed $entry, array $memberIds, array $seen): ?int
    {
        $personId = is_array($entry) ? ($entry['person_id'] ?? null) : null;
        if (!is_int($personId) || !in_array($personId, $memberIds, true)) {
            $this->fail($field, 'not_a_member', 'Only people on the trip can be chosen.');
            return null;
        }
        if (array_key_exists($personId, $seen)) {
            $this->fail($field, 'duplicate', 'Each person can only be chosen once.');
            return null;
        }

        return $personId;
    }

    private function hasErrorsFor(string $field): bool
    {
        foreach (array_keys($this->errors) as $key) {
            if ($key === $field || str_starts_with($key, "{$field}.")) {
                return true;
            }
        }

        return false;
    }

    private function fail(string $field, string $code, string $message): void
    {
        $this->errors[$field] ??= ['code' => $code, 'message' => $message];
    }
}
