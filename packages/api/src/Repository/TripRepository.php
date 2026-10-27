<?php

declare(strict_types=1);

namespace App\Repository;

use App\Dto\Person;
use App\Dto\Trip;
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
            'SELECT t.*, v.total_cents
             FROM trips t
             JOIN v_trip_totals v ON v.trip_id = t.id
             ORDER BY t.start_date DESC, t.id DESC'
        )->fetchAll();

        return array_map(fn (array $row): Trip => $this->toTrip($row), $rows);
    }

    public function find(int $tripId): ?Trip
    {
        $stmt = $this->pdo->prepare(
            'SELECT t.*, v.total_cents
             FROM trips t
             JOIN v_trip_totals v ON v.trip_id = t.id
             WHERE t.id = ?'
        );
        $stmt->execute([$tripId]);
        $row = $stmt->fetch();

        return $row === false ? null : $this->toTrip($row, $this->findMembers($tripId));
    }

    /** @return list<Person> */
    public function findMembers(int $tripId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT p.id, p.name
             FROM trip_members m
             JOIN people p ON p.id = m.person_id
             WHERE m.trip_id = ?
             ORDER BY p.id'
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

    /** @param list<Person>|null $members */
    private function toTrip(array $row, ?array $members = null): Trip
    {
        return new Trip(
            (int) $row['id'],
            $row['name'],
            $row['start_date'],
            $row['end_date'],
            (int) $row['total_cents'],
            $members,
        );
    }
}
