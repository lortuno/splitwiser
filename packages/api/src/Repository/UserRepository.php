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
    public function create(string $displayName, string $email, string $passwordHash): int
    {
        $this->pdo->prepare('INSERT INTO users (display_name, email, password_hash) VALUES (?, ?, ?)')
            ->execute([$displayName, $email, $passwordHash]);

        return (int) $this->pdo->lastInsertId();
    }

    public function find(int $userId): ?User
    {
        $stmt = $this->pdo->prepare('SELECT id, display_name, email FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        return $row === false ? null : self::toUser($row);
    }

    /** @return array{User, string}|null the user and their password hash */
    public function findWithHashByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare('SELECT id, display_name, email, password_hash FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        return $row === false ? null : [self::toUser($row), $row['password_hash']];
    }

    public function idByEmail(string $email): ?int
    {
        $stmt = $this->pdo->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $id = $stmt->fetchColumn();

        return $id === false ? null : (int) $id;
    }

    public function updateDisplayName(int $userId, string $displayName): void
    {
        $this->pdo->prepare('UPDATE users SET display_name = ? WHERE id = ?')->execute([$displayName, $userId]);
    }

    public function touchLastLogin(int $userId): void
    {
        $this->pdo->prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$userId]);
    }

    private static function toUser(array $row): User
    {
        return new User((int) $row['id'], $row['display_name'], $row['email']);
    }
}
