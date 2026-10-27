<?php

declare(strict_types=1);

// Creates/updates the schema and seeds the demo trip when the database has no trips yet.

use App\Container;
use App\Database\Connection;
use App\Database\Schema;

require dirname(__DIR__) . '/bootstrap.php';

$pdo = Connection::open();
Schema::apply($pdo);
$seeded = (new Container($pdo))->seeder()->seedIfEmpty();

fwrite(STDOUT, $seeded ? "Database created and seeded.\n" : "Database ready (already has data).\n");
