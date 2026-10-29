<?php

declare(strict_types=1);

use App\Database\Schema;

// An existing database is renamed from trips to groups in place (specs/groups/03-create-a-group-specification.md).

/** Turns a seeded database back into the schema from before groups: trip tables, trip_id columns, required dates. */
function toTripsSchema(PDO $pdo): void
{
    $pdo->exec('PRAGMA foreign_keys = OFF');
    foreach (['v_expense_list', 'v_trip_status', 'v_member_balances', 'v_trip_totals', 'v_expense_shares', 'v_person_names'] as $view) {
        $pdo->exec("DROP VIEW {$view}");
    }
    foreach (['idx_group_invites_email', 'idx_group_members_group_id', 'idx_group_members_person_id', 'idx_expenses_group_id', 'idx_expenses_group_id_spent_on', 'idx_group_status_changes_group_id'] as $index) {
        $pdo->exec("DROP INDEX {$index}");
    }
    $pdo->exec('CREATE TABLE trips (id INTEGER PRIMARY KEY, name TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL)');
    $pdo->exec('INSERT INTO trips SELECT id, name, start_date, end_date FROM groups');
    $pdo->exec('DROP TABLE groups');
    // Renaming a table also renames the references to it, so the child tables point at trips again.
    $pdo->exec('ALTER TABLE trips RENAME TO groups');
    $pdo->exec('ALTER TABLE groups RENAME TO trips');
    foreach (['group_members' => 'trip_members', 'group_invites' => 'trip_invites', 'group_status_changes' => 'trip_status_changes'] as $new => $old) {
        $pdo->exec("ALTER TABLE {$new} RENAME TO {$old}");
    }
    foreach (['trip_members', 'trip_status_changes', 'expenses'] as $table) {
        $pdo->exec("ALTER TABLE {$table} RENAME COLUMN group_id TO trip_id");
    }
    $pdo->exec('CREATE INDEX idx_trip_members_trip_id ON trip_members (trip_id)');
    $pdo->exec('CREATE INDEX idx_expenses_trip_id ON expenses (trip_id)');
    $pdo->exec('PRAGMA foreign_keys = ON');
}

/** @return list<string> */
function tableNames(PDO $pdo): array
{
    return $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
}

/** Every row and figure a rename must keep, as JSON. */
function everything(App\Container $app): string
{
    $rows = [];
    foreach (['groups', 'group_members', 'group_invites', 'group_status_changes', 'expenses', 'expense_payers', 'expense_splits', 'people', 'users'] as $table) {
        $rows[$table] = $app->pdo->query("SELECT * FROM {$table} ORDER BY rowid")->fetchAll();
    }
    foreach ($app->trips->findAll() as $trip) {
        $rows['figures'][] = [$trip, $app->summaries->forTrip($trip->id), $app->expenses->list($trip->id)];
    }

    return json_encode($rows);
}

test('an existing database is renamed from trips to groups in place, once, keeping every row and figure', function (): void {
    $app = seededApp();
    $ana = tokenFor($app, 'ana@example.com');
    assertSame(200, call($app, 'POST', '/trips/7/paid', [], $ana)->status);
    $before = everything($app);

    toTripsSchema($app->pdo);
    assertTrue(in_array('trips', tableNames($app->pdo), true), 'The test database has the old schema.');

    assertSame(true, Schema::apply($app->pdo), 'Renamed.');
    $tables = tableNames($app->pdo);
    foreach (['groups', 'group_members', 'group_invites', 'group_status_changes'] as $table) {
        assertTrue(in_array($table, $tables, true), "{$table} exists");
    }
    assertSame([], array_values(array_filter($tables, fn (string $t) => str_starts_with($t, 'trip'))), 'No trip table is left.');
    assertSame($before, everything($app));
    assertSame([], $app->pdo->query('PRAGMA foreign_key_check')->fetchAll());
    assertSame(1, (int) $app->pdo->query('PRAGMA foreign_keys')->fetchColumn(), 'Foreign keys are on again.');
    assertSame(
        [],
        $app->pdo->query("SELECT name FROM sqlite_master WHERE type IN ('table', 'index') AND (name LIKE '%trip%' OR sql LIKE '%trip%')")->fetchAll(PDO::FETCH_COLUMN),
        'Only the views keep trip names.',
    );

    assertSame(false, Schema::apply($app->pdo), 'A second start leaves it alone.');
    assertSame($before, everything($app));
    assertSame(201, call($app, 'POST', '/trips', ['name' => 'No dates', 'people' => [['name' => 'Ben']]], $ana)->status, 'Dates may be empty now.');
});

test('a failed rename changes nothing', function (): void {
    $app = seededApp();
    toTripsSchema($app->pdo);
    // A payer without a person: the foreign key check before the commit fails.
    $app->pdo->exec('PRAGMA foreign_keys = OFF');
    $app->pdo->exec('INSERT INTO expense_payers (expense_id, person_id, amount_cents) VALUES (1, 999, 1)');
    $app->pdo->exec('PRAGMA foreign_keys = ON');
    $tables = tableNames($app->pdo);

    $failed = false;
    try {
        Schema::apply($app->pdo);
    } catch (RuntimeException) {
        $failed = true;
    }
    assertTrue($failed, 'Expected the rename to fail.');
    assertSame($tables, tableNames($app->pdo));
    assertSame(20, (int) $app->pdo->query('SELECT COUNT(*) FROM expenses WHERE trip_id = 1')->fetchColumn());
    assertSame(1, (int) $app->pdo->query('PRAGMA foreign_keys')->fetchColumn());
});
