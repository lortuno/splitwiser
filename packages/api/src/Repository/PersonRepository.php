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

    /** Keeps $email (trimmed, lowercased) for a person without an account, until that email signs up. */
    public function invite(int $personId, string $email): void
    {
        $this->pdo->prepare('INSERT INTO group_invites (person_id, email) VALUES (?, ?)')->execute([$personId, $email]);
    }

    /** Links every person invited with $email to $userId and removes those invites. */
    public function linkInvites(string $email, int $userId): void
    {
        $this->pdo->prepare(
            'UPDATE people SET user_id = ? WHERE user_id IS NULL AND id IN (SELECT person_id FROM group_invites WHERE email = ?)'
        )->execute([$userId, $email]);
        $this->pdo->prepare('DELETE FROM group_invites WHERE email = ?')->execute([$email]);
    }
}
