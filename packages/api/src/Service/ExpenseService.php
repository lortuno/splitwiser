<?php

declare(strict_types=1);

namespace App\Service;

use App\Dto\Expense;
use App\Dto\Payer;
use App\Dto\Person;
use App\Dto\SplitEntry;
use App\Dto\SplitShare;
use App\Dto\SplitType;
use App\Dto\User;
use App\Repository\ExpenseRepository;
use App\Repository\TripRepository;
use PDO;

final readonly class ExpenseService
{
    public function __construct(
        private PDO $pdo,
        private TripRepository $trips,
        private ExpenseRepository $expenses,
        private ExpenseValidator $validator,
    ) {
    }

    /** @return list<Expense> */
    public function list(int $tripId): array
    {
        $this->memberIds($tripId);

        return $this->expenses->findByTrip($tripId);
    }

    public function create(int $tripId, array $input): Expense
    {
        $memberIds = $this->memberIds($tripId);
        $this->assertOpen($tripId);
        $expense = $this->validator->validate($input, $memberIds);

        $this->pdo->beginTransaction();
        try {
            $expenseId = $this->expenses->insert($tripId, $expense);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return $this->expenses->find($expenseId);
    }

    /**
     * Corrects a saved expense of the trip. The recorder never changes. Errors in order: 404 for an expense that is not
     * on this trip, 409 on a paid trip, then 422 as for a new expense. A save that changes nothing writes nothing.
     */
    public function update(int $tripId, int $expenseId, array $input, User $user): Expense
    {
        $memberIds = $this->memberIds($tripId);
        $current = $this->expenses->find($expenseId);
        if ($current === null || $current->tripId !== $tripId) {
            throw new NotFoundException("Expense {$expenseId} not found on trip {$tripId}.");
        }
        $this->assertOpen($tripId);
        $expense = $this->validator->validate([...$input, 'recorded_by' => $current->recordedBy->id], $memberIds);

        $before = self::snapshot($current->name, $current->date, $current->amountCents, $current->splitType,
            array_map(static fn (Payer $p): array => [$p->personId, $p->amountCents], $current->paidBy),
            array_map(static fn (SplitShare $s): array => [$s->personId, $s->splitValue], $current->splitBetween),
        );
        $after = self::snapshot($expense->name, $expense->date, $expense->amountCents, $expense->splitType,
            array_map(null, array_keys($expense->paidBy), $expense->paidBy),
            array_map(static fn (SplitEntry $e): array => [$e->personId, $e->value], $expense->splitBetween),
        );
        if ($before === $after) {
            return $current;
        }

        $this->pdo->beginTransaction();
        try {
            $this->expenses->update($expenseId, $expense);
            $this->expenses->recordChange($expenseId, $user->id, $before, $after);
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return $this->expenses->find($expenseId);
    }

    /**
     * Calculates the split for an expense without saving it: the rows are written inside a
     * transaction, read back through v_expense_shares and rolled back, so the preview uses
     * exactly the same calculation as stored expenses.
     *
     * @return list<SplitShare>
     */
    public function preview(int $tripId, array $input): array
    {
        $memberIds = $this->memberIds($tripId);
        $this->assertOpen($tripId);
        $expense = $this->validator->validate($input, $memberIds);

        $this->pdo->beginTransaction();
        try {
            $expenseId = $this->expenses->insert($tripId, $expense);
            return $this->expenses->find($expenseId)->splitBetween;
        } finally {
            $this->pdo->rollBack();
        }
    }

    /**
     * The full input of an expense in one canonical JSON form, people sorted by id; value is null for an equal split.
     *
     * @param list<array{int, int}> $paidBy [person id, cents]
     * @param list<array{int, ?int}> $between [person id, split value]
     */
    private static function snapshot(string $name, string $date, int $amountCents, SplitType $type, array $paidBy, array $between): string
    {
        $entries = static function (array $pairs, string $key): array {
            usort($pairs, static fn (array $a, array $b): int => $a[0] <=> $b[0]);

            return array_map(static fn (array $pair): array => ['person_id' => $pair[0], $key => $pair[1]], $pairs);
        };

        return json_encode([
            'name' => $name,
            'date' => $date,
            'amount_cents' => $amountCents,
            'paid_by' => $entries($paidBy, 'amount_cents'),
            'split' => ['type' => $type->value, 'between' => $entries($between, 'value')],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private function assertOpen(int $tripId): void
    {
        if ($this->trips->isPaid($tripId)) {
            throw ConflictException::tripPaid();
        }
    }

    /** @return list<int> */
    private function memberIds(int $tripId): array
    {
        $trip = $this->trips->find($tripId) ?? throw new NotFoundException("Trip {$tripId} not found.");

        return array_map(static fn (Person $p): int => $p->id, $trip->members);
    }
}
