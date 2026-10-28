<?php

declare(strict_types=1);

namespace App\Service;

use App\Dto\Trip;
use App\Dto\User;
use App\Repository\PersonRepository;
use App\Repository\TripRepository;
use App\Repository\UserRepository;
use PDO;

/**
 * Creates a trip: the logged-in user is always the first member, linked to their account. Every other person is a
 * typed name with an optional email. An email of an existing account links the person at once; any other email is
 * kept in trip_invites until it signs up. The response never tells which of the two happened.
 * Errors are keyed like the form: name, start_date, end_date, people, people.{i}.name, people.{i}.email.
 */
final readonly class TripService
{
    public const int MAX_NAME_LENGTH = 80;
    public const int MAX_PERSON_NAME_LENGTH = 60;
    public const int MAX_PEOPLE = 20;

    public function __construct(
        private PDO $pdo,
        private TripRepository $trips,
        private PersonRepository $people,
        private UserRepository $users,
    ) {
    }

    public function create(User $creator, array $input): Trip
    {
        $errors = [];
        $name = self::trimmed($input['name'] ?? null);
        if ($name === '') {
            $errors['name'] = self::error('required', 'Enter a name for the trip.');
        } elseif (mb_strlen($name) > self::MAX_NAME_LENGTH) {
            $errors['name'] = self::error('too_long', 'Use at most 80 characters.');
        }

        $startDate = self::date($input['start_date'] ?? null);
        $endDate = self::date($input['end_date'] ?? null);
        if ($startDate === null) {
            $errors['start_date'] = self::error('invalid_date', 'Enter a date as YYYY-MM-DD.');
        }
        if ($endDate === null) {
            $errors['end_date'] = self::error('invalid_date', 'Enter a date as YYYY-MM-DD.');
        } elseif ($startDate !== null && $endDate < $startDate) {
            $errors['end_date'] = self::error('before_start', 'The end date is before the start.');
        }

        $people = is_array($input['people'] ?? null) && array_is_list($input['people']) ? $input['people'] : [];
        if ($people === []) {
            $errors['people'] = self::error('too_few', 'Add at least one more person.');
        } elseif (count($people) > self::MAX_PEOPLE - 1) {
            $errors['people'] = self::error('too_many', 'A trip can have at most 20 people.');
        }

        // The creator's name and email count as taken; names compare without case, emails are normalised.
        $takenNames = [mb_strtolower($creator->displayName) => true];
        $takenEmails = [$creator->email => true];
        $others = [];
        foreach ($people as $i => $person) {
            $personName = self::trimmed(is_array($person) ? ($person['name'] ?? null) : null);
            $email = AuthService::normaliseEmail(is_array($person) ? ($person['email'] ?? null) : null);

            if ($personName === '') {
                $errors["people.{$i}.name"] = self::error('required', 'Enter a name.');
            } elseif (mb_strlen($personName) > self::MAX_PERSON_NAME_LENGTH) {
                $errors["people.{$i}.name"] = self::error('too_long', 'Use at most 60 characters.');
            } elseif (isset($takenNames[mb_strtolower($personName)])) {
                $errors["people.{$i}.name"] = self::error('duplicate', 'This name is already on the trip.');
            }
            $takenNames[mb_strtolower($personName)] = true;

            if ($email !== '' && !AuthService::isPlausibleEmail($email)) {
                $errors["people.{$i}.email"] = self::error('invalid_email', 'Enter an email like ana@example.com.');
            } elseif ($email !== '' && isset($takenEmails[$email])) {
                $errors["people.{$i}.email"] = self::error('duplicate_email', 'This email is already on the trip.');
            }
            if ($email !== '') {
                $takenEmails[$email] = true;
            }

            $others[] = [$personName, $email === '' ? null : $email];
        }

        if ($errors !== []) {
            throw new ValidationException($errors);
        }

        $this->pdo->beginTransaction();
        try {
            $tripId = $this->trips->create($name, $startDate, $endDate);
            $this->trips->addMember($tripId, $this->people->create($creator->displayName, $creator->id));
            foreach ($others as [$personName, $email]) {
                $userId = $email === null ? null : $this->users->idByEmail($email);
                $personId = $this->people->create($personName, $userId);
                $this->trips->addMember($tripId, $personId);
                if ($email !== null && $userId === null) {
                    $this->people->invite($personId, $email);
                }
            }
            $this->pdo->commit();
        } catch (\Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }

        return $this->trips->find($tripId);
    }

    /** A real calendar date as YYYY-MM-DD, or null. */
    private static function date(mixed $value): ?string
    {
        $valid = is_string($value)
            && preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m) === 1
            && checkdate((int) $m[2], (int) $m[3], (int) $m[1]);

        return $valid ? $value : null;
    }

    private static function trimmed(mixed $value): string
    {
        return is_string($value) ? trim($value) : '';
    }

    /** @return array{code: string, message: string} */
    private static function error(string $code, string $message): array
    {
        return ['code' => $code, 'message' => $message];
    }
}
