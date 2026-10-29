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

    /** $email must already be trimmed and lowercased. Seeded accounts are created verified, sign-ups are not. */
    public function create(string $displayName, string $email, string $passwordHash, string $language = 'en', bool $verified = false): int
    {
        $this->pdo->prepare(
            'INSERT INTO users (display_name, email, password_hash, language, verified_at) VALUES (?, ?, ?, ?, CASE WHEN ? THEN CURRENT_TIMESTAMP END)'
        )->execute([$displayName, $email, $passwordHash, $language, (int) $verified]);

        return (int) $this->pdo->lastInsertId();
    }

    public function find(int $userId): ?User
    {
        $stmt = $this->pdo->prepare('SELECT id, display_name, email, language FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        return $row === false ? null : self::toUser($row);
    }

    /** @return array{User, string, bool}|null the user, their password hash and whether their email is verified */
    public function findWithHashByEmail(string $email): ?array
    {
        $stmt = $this->pdo->prepare('SELECT id, display_name, email, language, password_hash, verified_at FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        return $row === false ? null : [self::toUser($row), $row['password_hash'], $row['verified_at'] !== null];
    }

    /** A sign-up again before the code: the new name, password and language replace the unverified account's. */
    public function replaceUnverified(int $userId, string $displayName, string $passwordHash, string $language): void
    {
        $this->pdo->prepare('UPDATE users SET display_name = ?, password_hash = ?, language = ? WHERE id = ? AND verified_at IS NULL')
            ->execute([$displayName, $passwordHash, $language, $userId]);
    }

    public function markVerified(int $userId): void
    {
        $this->pdo->prepare('UPDATE users SET verified_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$userId]);
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

    public function updateLanguage(int $userId, string $language): void
    {
        $this->pdo->prepare('UPDATE users SET language = ? WHERE id = ?')->execute([$language, $userId]);
    }

    public function touchLastLogin(int $userId): void
    {
        $this->pdo->prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$userId]);
    }

    private static function toUser(array $row): User
    {
        return new User((int) $row['id'], $row['display_name'], $row['email'], $row['language']);
    }
}
