<?php

declare(strict_types=1);

namespace App\Database;

use PDO;

final class Connection
{
    /** Opens the SQLite database at $path, DB_PATH, or packages/api/var/app.sqlite (in that order). */
    public static function open(?string $path = null): PDO
    {
        $path ??= getenv('DB_PATH') ?: dirname(__DIR__, 2) . '/var/app.sqlite';

        if ($path !== ':memory:' && !is_dir(dirname($path))) {
            mkdir(dirname($path), 0775, true);
        }

        $pdo = new PDO('sqlite:' . $path, options: [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA busy_timeout = 5000');
        if ($path !== ':memory:') {
            $pdo->exec('PRAGMA journal_mode = WAL');
        }

        return $pdo;
    }
}
