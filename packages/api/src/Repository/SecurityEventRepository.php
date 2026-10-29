<?php

declare(strict_types=1);

namespace App\Repository;

use PDO;

/**
 * The security log, and the source of every limit and of the login lock. Times are UTC "Y-m-d H:i:s" from the clock,
 * so they compare as strings. Never holds a password, a code or a token.
 */
final readonly class SecurityEventRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function add(string $event, ?string $email, string $ip, string $at): void
    {
        $this->pdo->prepare('INSERT INTO security_events (event, email, ip, at) VALUES (?, ?, ?, ?)')
            ->execute([$event, $email, $ip, $at]);
    }

    /**
     * Events of the given kinds since $since (exclusive), filtered by email and/or IP when given.
     * @param list<string> $events
     */
    public function count(array $events, string $since, ?string $email = null, ?string $ip = null): int
    {
        [$where, $params] = self::filter($events, $since, $email, $ip);
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM security_events WHERE {$where}");
        $stmt->execute($params);

        return (int) $stmt->fetchColumn();
    }

    /**
     * The time of the latest such event, or null.
     * @param list<string> $events
     */
    public function lastAt(array $events, ?string $email = null, ?string $ip = null): ?string
    {
        [$where, $params] = self::filter($events, '', $email, $ip);
        $stmt = $this->pdo->prepare("SELECT MAX(at) FROM security_events WHERE {$where}");
        $stmt->execute($params);
        $at = $stmt->fetchColumn();

        return is_string($at) ? $at : null;
    }

    /** @return array{string, list<string>} */
    private static function filter(array $events, string $since, ?string $email, ?string $ip): array
    {
        $where = 'event IN (' . implode(', ', array_fill(0, count($events), '?')) . ') AND at > ?';
        $params = [...$events, $since];
        if ($email !== null) {
            $where .= ' AND email = ?';
            $params[] = $email;
        }
        if ($ip !== null) {
            $where .= ' AND ip = ?';
            $params[] = $ip;
        }

        return [$where, $params];
    }
}
