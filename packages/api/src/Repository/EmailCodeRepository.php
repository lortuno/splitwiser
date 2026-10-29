<?php

declare(strict_types=1);

namespace App\Repository;

use PDO;

/** The pending sign-up code of an unverified account: only its SHA-256, the tries left and when it expires. */
final readonly class EmailCodeRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** A new code replaces the old one. */
    public function replace(int $userId, string $codeHash, int $tries, string $expiresAt): void
    {
        $this->pdo->prepare('INSERT OR REPLACE INTO email_codes (user_id, code_hash, tries_left, expires_at) VALUES (?, ?, ?, ?)')
            ->execute([$userId, $codeHash, $tries, $expiresAt]);
    }

    /** @return array{code_hash: string, tries_left: int, expires_at: string}|null */
    public function find(int $userId): ?array
    {
        $stmt = $this->pdo->prepare('SELECT code_hash, tries_left, expires_at FROM email_codes WHERE user_id = ?');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();

        return $row === false ? null : ['code_hash' => $row['code_hash'], 'tries_left' => (int) $row['tries_left'], 'expires_at' => $row['expires_at']];
    }

    /** @return int the tries left after this wrong one */
    public function useTry(int $userId): int
    {
        $this->pdo->prepare('UPDATE email_codes SET tries_left = tries_left - 1 WHERE user_id = ? AND tries_left > 0')->execute([$userId]);

        return $this->find($userId)['tries_left'] ?? 0;
    }

    public function delete(int $userId): void
    {
        $this->pdo->prepare('DELETE FROM email_codes WHERE user_id = ?')->execute([$userId]);
    }
}
