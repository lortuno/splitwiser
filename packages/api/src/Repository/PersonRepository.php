<?php

declare(strict_types=1);

namespace App\Repository;

use PDO;

final readonly class PersonRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function create(string $name, ?int $userId = null): int
    {
        $this->pdo->prepare('INSERT INTO people (name, user_id) VALUES (?, ?)')->execute([$name, $userId]);

        return (int) $this->pdo->lastInsertId();
    }
}
