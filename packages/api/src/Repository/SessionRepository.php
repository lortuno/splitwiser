<?php

declare(strict_types=1);

namespace App\Repository;

use PDO;

/** Sessions by token hash. Times are SQLite UTC timestamps; an expired session counts as missing. */
final readonly class SessionRepository
{
    public const string LIFETIME = '+24 hours';

    public function __construct(private PDO $pdo)
    {
    }

    public function create(string $tokenHash, int $userId): void
    {
        $this->pdo->prepare(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, datetime('now', ?))"
        )->execute([$tokenHash, $userId, self::LIFETIME]);
    }

    public function findUserId(string $tokenHash): ?int
    {
        $stmt = $this->pdo->prepare("SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > datetime('now')");
        $stmt->execute([$tokenHash]);
        $id = $stmt->fetchColumn();

        return $id === false ? null : (int) $id;
    }

    public function delete(string $tokenHash): void
    {
        $this->pdo->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([$tokenHash]);
    }
}
