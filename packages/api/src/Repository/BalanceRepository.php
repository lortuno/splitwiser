<?php

declare(strict_types=1);

namespace App\Repository;

use App\Dto\Balance;
use PDO;

final readonly class BalanceRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @return list<Balance> ordered by person id */
    public function findByTrip(int $tripId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT person_id, name, paid_cents, share_cents, net_cents
             FROM v_member_balances
             WHERE trip_id = ?
             ORDER BY person_id'
        );
        $stmt->execute([$tripId]);

        return array_map(
            static fn (array $row): Balance => new Balance(
                (int) $row['person_id'],
                $row['name'],
                (int) $row['paid_cents'],
                (int) $row['share_cents'],
                (int) $row['net_cents'],
            ),
            $stmt->fetchAll(),
        );
    }
}
