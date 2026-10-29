<?php

declare(strict_types=1);

namespace App\Database;

use PDO;

/**
 * Two kinds of objects:
 *  - input tables hold only what a user states (amounts, people, split values);
 *  - v_* views derive everything else (split cents, totals, balances) and are never written to.
 * Tables are created idempotently; views are dropped and recreated so their logic follows the code.
 */
final class Schema
{
    private const array TABLES = [
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS groups (
            id         INTEGER PRIMARY KEY,
            name       TEXT NOT NULL,
            start_date TEXT,
            end_date   TEXT,
            CHECK ((start_date IS NULL) = (end_date IS NULL))
        )
        SQL,
        // Accounts. Emails are stored trimmed and lowercased; only a password_hash() is kept.
        // display_name is the only name the app shows for a linked person; last_login_at is never shown.
        // language is the app language the person chose (en, es or fr); the app starts in it.
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY,
            display_name  TEXT NOT NULL,
            email         TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_login_at TEXT,
            language      TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es', 'fr'))
        )
        SQL,
        // One row per login. Only the SHA-256 of the bearer token is stored.
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY,
            user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at TEXT NOT NULL
        )
        SQL,
        // user_id links a group member to an account; NULL for people without one.
        // name is what the group's creator typed; a linked person shows users.display_name instead.
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS people (
            id      INTEGER PRIMARY KEY,
            name    TEXT NOT NULL,
            user_id INTEGER REFERENCES users (id)
        )
        SQL,
        // An email typed for a person that has no account yet. The first sign-up with it links the person.
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS group_invites (
            person_id INTEGER PRIMARY KEY REFERENCES people (id) ON DELETE CASCADE,
            email     TEXT NOT NULL
        )
        SQL,
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS group_members (
            group_id  INTEGER NOT NULL REFERENCES groups (id),
            person_id INTEGER NOT NULL REFERENCES people (id),
            PRIMARY KEY (group_id, person_id)
        )
        SQL,
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS expenses (
            id           INTEGER PRIMARY KEY,
            group_id     INTEGER NOT NULL REFERENCES groups (id),
            name         TEXT    NOT NULL,
            spent_on     TEXT    NOT NULL,
            amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
            recorded_by  INTEGER NOT NULL,
            split_type   TEXT    NOT NULL CHECK (split_type IN ('equal', 'exact', 'percentage', 'shares')),
            created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            category     TEXT    CHECK (category IS NULL OR category IN ('food', 'groceries', 'drinks', 'coffee', 'fuel', 'transport', 'flights', 'lodging', 'activities', 'shopping', 'other')),
            FOREIGN KEY (group_id, recorded_by) REFERENCES group_members (group_id, person_id)
        )
        SQL,
        // "Paid by": who handed over money, and how much.
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS expense_payers (
            expense_id   INTEGER NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
            person_id    INTEGER NOT NULL REFERENCES people (id),
            amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
            PRIMARY KEY (expense_id, person_id)
        )
        SQL,
        // "Split between": who bears the cost. split_value is the raw input:
        // NULL for equal, cents for exact, basis points for percentage, units for shares.
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS expense_splits (
            expense_id  INTEGER NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
            person_id   INTEGER NOT NULL REFERENCES people (id),
            split_value INTEGER CHECK (split_value IS NULL OR split_value > 0),
            PRIMARY KEY (expense_id, person_id)
        )
        SQL,
        // One row per saved edit: who changed the expense, when, and the full input before and after
        // (see ExpenseService::snapshot). Rows are never updated or deleted.
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS expense_changes (
            id          INTEGER PRIMARY KEY,
            expense_id  INTEGER NOT NULL REFERENCES expenses (id) ON DELETE CASCADE,
            changed_by  INTEGER NOT NULL REFERENCES users (id),
            changed_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            before_json TEXT    NOT NULL,
            after_json  TEXT    NOT NULL
        )
        SQL,
        // Marking a group as paid or reopening it. The latest row is the group's status (v_trip_status); no row means open.
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS group_status_changes (
            id         INTEGER PRIMARY KEY,
            group_id   INTEGER NOT NULL REFERENCES groups (id),
            status     TEXT    NOT NULL CHECK (status IN ('paid', 'open')),
            changed_by INTEGER NOT NULL REFERENCES users (id),
            changed_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        SQL,
    ];

    private const array INDEXES = [
        'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)',
        'CREATE INDEX IF NOT EXISTS idx_people_user_id ON people (user_id)',
        'CREATE INDEX IF NOT EXISTS idx_group_invites_email ON group_invites (email)',
        'CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members (group_id)',
        'CREATE INDEX IF NOT EXISTS idx_group_members_person_id ON group_members (person_id)',
        'CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON expenses (group_id)',
        'CREATE INDEX IF NOT EXISTS idx_expenses_group_id_spent_on ON expenses (group_id, spent_on)',
        'CREATE INDEX IF NOT EXISTS idx_expenses_recorded_by ON expenses (recorded_by)',
        'CREATE INDEX IF NOT EXISTS idx_expense_payers_expense_id ON expense_payers (expense_id)',
        'CREATE INDEX IF NOT EXISTS idx_expense_payers_person_id ON expense_payers (person_id)',
        'CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits (expense_id)',
        'CREATE INDEX IF NOT EXISTS idx_expense_splits_person_id ON expense_splits (person_id)',
        'CREATE INDEX IF NOT EXISTS idx_expense_changes_expense_id ON expense_changes (expense_id)',
        'CREATE INDEX IF NOT EXISTS idx_group_status_changes_group_id ON group_status_changes (group_id)',
    ];

    /**
     * Columns added after their table was first created: SQLite cannot add them in CREATE TABLE IF NOT EXISTS, so
     * apply() adds each one that an existing database lacks. table => [column => definition].
     */
    private const array ADDED_COLUMNS = [
        // What the expense was for (App\Dto\Category). NULL only until bin/init-db.php guesses it once.
        // The app language of the account (en, es, fr); existing accounts become English.
        'users' => ['language' => "TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es', 'fr'))"],
        'expenses' => ['category' => "TEXT CHECK (category IS NULL OR category IN ('food', 'groceries', 'drinks', 'coffee', 'fuel', 'transport', 'flights', 'lodging', 'activities', 'shopping', 'other'))"],
    ];

    /** Views in dependency order. */
    private const array VIEWS = [
        // The name the app shows for each person: the account's display name when linked, else the typed name.
        'v_person_names' => <<<'SQL'
        CREATE VIEW v_person_names AS
        SELECT p.id AS person_id, COALESCE(u.display_name, p.name) AS name
        FROM people p
        LEFT JOIN users u ON u.id = p.user_id
        SQL,
        // Each person's share of an expense, in cents.
        // Rounding rule: everyone gets floor(amount * weight / total_weight); the leftover cents
        // go one each to the largest remainders, ties broken by ascending person id.
        // Equal splits use weight 1, so their leftover cents go to the lowest person ids.
        'v_expense_shares' => <<<'SQL'
        CREATE VIEW v_expense_shares AS
        WITH weighted AS (
            SELECT e.id AS expense_id,
                   e.group_id AS trip_id,
                   s.person_id,
                   e.amount_cents,
                   CASE e.split_type WHEN 'equal' THEN 1 ELSE s.split_value END AS weight
            FROM expenses e
            JOIN expense_splits s ON s.expense_id = e.id
        ),
        floored AS (
            SELECT w.*,
                   (w.amount_cents * w.weight) / SUM(w.weight) OVER (PARTITION BY w.expense_id) AS base_cents,
                   (w.amount_cents * w.weight) % SUM(w.weight) OVER (PARTITION BY w.expense_id) AS remainder
            FROM weighted w
        ),
        ranked AS (
            SELECT f.*,
                   f.amount_cents - SUM(f.base_cents) OVER (PARTITION BY f.expense_id) AS leftover_cents,
                   ROW_NUMBER() OVER (PARTITION BY f.expense_id ORDER BY f.remainder DESC, f.person_id) AS remainder_rank
            FROM floored f
        )
        SELECT expense_id,
               trip_id,
               person_id,
               base_cents + (remainder_rank <= leftover_cents) AS share_cents
        FROM ranked
        SQL,
        'v_trip_totals' => <<<'SQL'
        CREATE VIEW v_trip_totals AS
        SELECT t.id                             AS trip_id,
               COALESCE(SUM(e.amount_cents), 0) AS total_cents,
               COUNT(e.id)                      AS expense_count
        FROM groups t
        LEFT JOIN expenses e ON e.group_id = t.id
        GROUP BY t.id
        SQL,
        'v_member_balances' => <<<'SQL'
        CREATE VIEW v_member_balances AS
        WITH paid AS (
            SELECT e.group_id AS trip_id, p.person_id, SUM(p.amount_cents) AS paid_cents
            FROM expense_payers p
            JOIN expenses e ON e.id = p.expense_id
            GROUP BY e.group_id, p.person_id
        ),
        shared AS (
            SELECT trip_id, person_id, SUM(share_cents) AS share_cents
            FROM v_expense_shares
            GROUP BY trip_id, person_id
        )
        SELECT m.group_id AS trip_id,
               m.person_id,
               pe.name,
               COALESCE(paid.paid_cents, 0)                                  AS paid_cents,
               COALESCE(shared.share_cents, 0)                               AS share_cents,
               COALESCE(paid.paid_cents, 0) - COALESCE(shared.share_cents, 0) AS net_cents
        FROM group_members m
        JOIN v_person_names pe ON pe.person_id = m.person_id
        LEFT JOIN paid ON paid.trip_id = m.group_id AND paid.person_id = m.person_id
        LEFT JOIN shared ON shared.trip_id = m.group_id AND shared.person_id = m.person_id
        SQL,
        // Each group's current status: its latest status change, or 'open' without one.
        'v_trip_status' => <<<'SQL'
        CREATE VIEW v_trip_status AS
        SELECT t.id                       AS trip_id,
               COALESCE(s.status, 'open') AS status,
               s.changed_by,
               s.changed_at
        FROM groups t
        LEFT JOIN group_status_changes s
               ON s.id = (SELECT MAX(id) FROM group_status_changes WHERE group_id = t.id)
        SQL,
        // Read model for listing expenses: one row per expense with its people as JSON arrays.
        'v_expense_list' => <<<'SQL'
        CREATE VIEW v_expense_list AS
        SELECT e.id,
               e.group_id AS trip_id,
               e.name,
               e.spent_on,
               e.amount_cents,
               e.split_type,
               COALESCE(e.category, 'other') AS category,
               e.recorded_by,
               r.name AS recorded_by_name,
               EXISTS (SELECT 1 FROM expense_changes c WHERE c.expense_id = e.id) AS edited,
               (SELECT json_group_array(json_object(
                           'person_id', p.person_id, 'name', pp.name, 'amount_cents', p.amount_cents
                       ) ORDER BY p.person_id)
                FROM expense_payers p
                JOIN v_person_names pp ON pp.person_id = p.person_id
                WHERE p.expense_id = e.id) AS paid_by_json,
               (SELECT json_group_array(json_object(
                           'person_id', s.person_id, 'name', sp.name,
                           'split_value', es.split_value, 'share_cents', s.share_cents
                       ) ORDER BY s.person_id)
                FROM v_expense_shares s
                JOIN expense_splits es ON es.expense_id = s.expense_id AND es.person_id = s.person_id
                JOIN v_person_names sp ON sp.person_id = s.person_id
                WHERE s.expense_id = e.id) AS split_between_json
        FROM expenses e
        JOIN v_person_names r ON r.person_id = e.recorded_by
        SQL,
    ];

    /** The tables and columns renamed when trips became groups. old table => [new table, [old column => new]]. */
    private const array RENAMED_TABLES = [
        'trips' => ['groups', []],
        'trip_members' => ['group_members', ['trip_id' => 'group_id']],
        'trip_invites' => ['group_invites', []],
        'trip_status_changes' => ['group_status_changes', ['trip_id' => 'group_id']],
        'expenses' => ['expenses', ['trip_id' => 'group_id']],
    ];

    /** Indexes named after trip_id; INDEXES creates their group_id successors. */
    private const array RENAMED_INDEXES = [
        'idx_trip_invites_email',
        'idx_trip_members_trip_id',
        'idx_trip_members_person_id',
        'idx_expenses_trip_id',
        'idx_expenses_trip_id_spent_on',
        'idx_trip_status_changes_trip_id',
    ];

    /**
     * Creates or updates the schema in one transaction. A database from before groups (it still has a trips table)
     * is renamed in place first, keeping every id and row. Returns true when it was renamed.
     */
    public static function apply(PDO $pdo): bool
    {
        $rename = self::hasTable($pdo, 'trips');
        if ($rename) {
            // Rebuilding groups drops the table the others point at; the keys are checked before the commit instead.
            $pdo->exec('PRAGMA foreign_keys = OFF');
        }
        $pdo->beginTransaction();
        try {
            foreach (array_reverse(array_keys(self::VIEWS)) as $view) {
                $pdo->exec("DROP VIEW IF EXISTS {$view}");
            }
            if ($rename) {
                self::renameTripsToGroups($pdo);
            }
            foreach (self::TABLES as $sql) {
                $pdo->exec($sql);
            }
            foreach (self::ADDED_COLUMNS as $table => $columns) {
                $existing = array_column($pdo->query("PRAGMA table_info({$table})")->fetchAll(), 'name');
                foreach ($columns as $column => $definition) {
                    if (!in_array($column, $existing, true)) {
                        $pdo->exec("ALTER TABLE {$table} ADD COLUMN {$column} {$definition}");
                    }
                }
            }
            foreach (self::INDEXES as $sql) {
                $pdo->exec($sql);
            }
            foreach (self::VIEWS as $sql) {
                $pdo->exec($sql);
            }
            if ($rename && $pdo->query('PRAGMA foreign_key_check')->fetch() !== false) {
                throw new \RuntimeException('Renaming trips to groups left a broken foreign key.');
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        } finally {
            if ($rename) {
                $pdo->exec('PRAGMA foreign_keys = ON');
            }
        }

        return $rename;
    }

    /**
     * Renames the trip tables and columns (the other tables' foreign keys follow), then rebuilds groups once so its
     * dates may be empty: a new table takes the rows and the name, so the foreign keys keep pointing at groups.
     */
    private static function renameTripsToGroups(PDO $pdo): void
    {
        foreach (self::RENAMED_INDEXES as $index) {
            $pdo->exec("DROP INDEX IF EXISTS {$index}");
        }
        // A table a very old database never had is created by apply() afterwards.
        foreach (self::RENAMED_TABLES as $old => [$new, $columns]) {
            if (!self::hasTable($pdo, $old)) {
                continue;
            }
            if ($old !== $new) {
                $pdo->exec("ALTER TABLE {$old} RENAME TO {$new}");
            }
            foreach ($columns as $oldColumn => $newColumn) {
                $pdo->exec("ALTER TABLE {$new} RENAME COLUMN {$oldColumn} TO {$newColumn}");
            }
        }
        $pdo->exec(str_replace('EXISTS groups (', 'EXISTS groups_rebuilt (', self::TABLES[0]));
        $pdo->exec('INSERT INTO groups_rebuilt (id, name, start_date, end_date) SELECT id, name, start_date, end_date FROM groups');
        $pdo->exec('DROP TABLE groups');
        $pdo->exec('ALTER TABLE groups_rebuilt RENAME TO groups');
    }

    private static function hasTable(PDO $pdo, string $table): bool
    {
        $stmt = $pdo->prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?");
        $stmt->execute([$table]);

        return $stmt->fetchColumn() !== false;
    }
}
