<?php

declare(strict_types=1);

namespace App\Repository;

use App\Dto\Person;
use App\Dto\Trip;
use App\Dto\TripPaid;
use PDO;

final readonly class TripRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function create(string $name, string $startDate, string $endDate): int
    {
        $this->pdo->prepare('INSERT INTO trips (name, start_date, end_date) VALUES (?, ?, ?)')
            ->execute([$name, $startDate, $endDate]);

        return (int) $this->pdo->lastInsertId();
    }

    public function addMember(int $tripId, int $personId): void
    {
        $this->pdo->prepare('INSERT INTO trip_members (trip_id, person_id) VALUES (?, ?)')
            ->execute([$tripId, $personId]);
    }

    public function count(): int
    {
        return (int) $this->pdo->query('SELECT COUNT(*) FROM trips')->fetchColumn();
    }

    /** @return list<Trip> */
    public function findAll(): array
    {
        $rows = $this->pdo->query(
            "SELECT t.*, v.total_cents, s.status = 'paid' AS paid
             FROM trips t
             JOIN v_trip_totals v ON v.trip_id = t.id
             JOIN v_trip_status s ON s.trip_id = t.id
             ORDER BY t.start_date DESC, t.id DESC"
        )->fetchAll();

        return array_map(fn (array $row): Trip => $this->toTrip($row), $rows);
    }

    /** @return list<Trip> trips where one of the members is linked to $userId, newest first */
    public function findForUser(int $userId): array
    {
        $stmt = $this->pdo->prepare(
            "SELECT t.*, v.total_cents, s.status = 'paid' AS paid
             FROM trips t
             JOIN v_trip_totals v ON v.trip_id = t.id
             JOIN v_trip_status s ON s.trip_id = t.id
             WHERE EXISTS (
                 SELECT 1 FROM trip_members m JOIN people p ON p.id = m.person_id
                 WHERE m.trip_id = t.id AND p.user_id = ?
             )
             ORDER BY t.start_date DESC, t.id DESC"
        );
        $stmt->execute([$userId]);

        return array_map(fn (array $row): Trip => $this->toTrip($row), $stmt->fetchAll());
    }

    public function exists(int $tripId): bool
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM trips WHERE id = ?');
        $stmt->execute([$tripId]);

        return $stmt->fetchColumn() !== false;
    }

    /** The person that represents $userId on the trip, or null when the user is not a member. */
    public function personForUser(int $tripId, int $userId): ?int
    {
        $stmt = $this->pdo->prepare(
            'SELECT p.id FROM trip_members m JOIN people p ON p.id = m.person_id
             WHERE m.trip_id = ? AND p.user_id = ?
             ORDER BY p.id
             LIMIT 1'
        );
        $stmt->execute([$tripId, $userId]);
        $id = $stmt->fetchColumn();

        return $id === false ? null : (int) $id;
    }

    public function find(int $tripId): ?Trip
    {
        $stmt = $this->pdo->prepare(
            "SELECT t.*, v.total_cents, s.status = 'paid' AS paid
             FROM trips t
             JOIN v_trip_totals v ON v.trip_id = t.id
             JOIN v_trip_status s ON s.trip_id = t.id
             WHERE t.id = ?"
        );
        $stmt->execute([$tripId]);
        $row = $stmt->fetch();

        return $row === false ? null : $this->toTrip($row, $this->findMembers($tripId));
    }

    /** @return list<Person> */
    public function findMembers(int $tripId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT n.person_id AS id, n.name
             FROM trip_members m
             JOIN v_person_names n ON n.person_id = m.person_id
             WHERE m.trip_id = ?
             ORDER BY n.person_id'
        );
        $stmt->execute([$tripId]);

        return array_map(
            static fn (array $row): Person => new Person((int) $row['id'], $row['name']),
            $stmt->fetchAll(),
        );
    }

    /** @return array{total_cents: int, expense_count: int} */
    public function totals(int $tripId): array
    {
        $stmt = $this->pdo->prepare('SELECT total_cents, expense_count FROM v_trip_totals WHERE trip_id = ?');
        $stmt->execute([$tripId]);
        $row = $stmt->fetch() ?: ['total_cents' => 0, 'expense_count' => 0];

        return ['total_cents' => (int) $row['total_cents'], 'expense_count' => (int) $row['expense_count']];
    }

    public function isPaid(int $tripId): bool
    {
        $stmt = $this->pdo->prepare("SELECT status = 'paid' FROM v_trip_status WHERE trip_id = ?");
        $stmt->execute([$tripId]);

        return (bool) $stmt->fetchColumn();
    }

    /** Who marked the trip as paid (their person on the trip, with the name shown today) and when; null when open. */
    public function paid(int $tripId): ?TripPaid
    {
        $stmt = $this->pdo->prepare(
            "SELECT n.person_id, n.name, strftime('%Y-%m-%dT%H:%M:%SZ', s.changed_at) AS at
             FROM v_trip_status s
             JOIN trip_members m ON m.trip_id = s.trip_id
             JOIN people p ON p.id = m.person_id AND p.user_id = s.changed_by
             JOIN v_person_names n ON n.person_id = p.id
             WHERE s.trip_id = ? AND s.status = 'paid'
             ORDER BY p.id
             LIMIT 1"
        );
        $stmt->execute([$tripId]);
        $row = $stmt->fetch();

        return $row === false ? null : new TripPaid(new Person((int) $row['person_id'], $row['name']), $row['at']);
    }

    /** Appends a status row ('paid' or 'open'); the latest row is the trip's status. */
    public function addStatusChange(int $tripId, string $status, int $userId): void
    {
        $this->pdo->prepare('INSERT INTO trip_status_changes (trip_id, status, changed_by) VALUES (?, ?, ?)')
            ->execute([$tripId, $status, $userId]);
    }

    /** @param list<Person>|null $members */
    private function toTrip(array $row, ?array $members = null): Trip
    {
        return new Trip(
            (int) $row['id'],
            $row['name'],
            $row['start_date'],
            $row['end_date'],
            (int) $row['total_cents'],
            (bool) $row['paid'],
            $members,
        );
    }
}
