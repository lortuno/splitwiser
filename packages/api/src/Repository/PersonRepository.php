<?php

declare(strict_types=1);

namespace App\Repository;

use PDO;

final readonly class PersonRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function create(string $name): int
    {
        $this->pdo->prepare('INSERT INTO people (name) VALUES (?)')->execute([$name]);

        return (int) $this->pdo->lastInsertId();
    }
}
