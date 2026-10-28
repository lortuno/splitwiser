<?php

declare(strict_types=1);

// Creates/updates the schema, seeds the demo trip when the database has no trips yet, guesses the category of
// expenses stored before categories existed, and creates the local admin login when its email is free.

use App\Container;
use App\Database\Connection;
use App\Database\Schema;
use App\Database\Seeder;

require dirname(__DIR__) . '/bootstrap.php';

$pdo = Connection::open();
Schema::apply($pdo);
$container = new Container($pdo);
$seeded = $container->seeder()->seedIfEmpty();
$categorised = $container->expenses->backfillCategories();
$adminCreated = $container->seeder()->ensureAdmin();

fwrite(STDOUT, $seeded ? "Database created and seeded.\n" : "Database ready (already has data).\n");
if ($categorised > 0) {
    fwrite(STDOUT, "Guessed the category of {$categorised} existing expenses.\n");
}
fwrite(STDOUT, $adminCreated ? 'Admin account created: ' . Seeder::ADMIN['email'] . "\n" : "Admin account exists, left unchanged.\n");
