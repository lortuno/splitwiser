<?php

declare(strict_types=1);

namespace App\Repository;

use App\Dto\User;
use PDO;

final readonly class UserRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** $email must already be trimmed and lowercased. */
    public function create(string $name, string $email, string $passwordHash): int
    {
        $this->pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
            ->execute([$name, $email, $passwordHash]);

        return (int) $this->pdo->lastInsertId();
    }

    public function find(int $userId): ?User
    {
        $stmt = $this->pdo->prepare('SELECT id, name, email FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        return $row === false ? null : new User((int) $row['id'], $row['name'], $row['email']);
    }

    /** @return array{User, string}|null the user and their password hash */
    public function findWithHashByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        return $row === false ? null : [new User((int) $row['id'], $row['name'], $row['email']), $row['password_hash']];
    }

    public function idByEmail(string $email): ?int
    {
        $stmt = $this->pdo->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $id = $stmt->fetchColumn();

        return $id === false ? null : (int) $id;
    }
}
