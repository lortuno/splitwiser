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
        CREATE TABLE IF NOT EXISTS trips (
            id         INTEGER PRIMARY KEY,
            name       TEXT NOT NULL,
            start_date TEXT NOT NULL,
            end_date   TEXT NOT NULL
        )
        SQL,
        // Accounts. Emails are stored trimmed and lowercased; only a password_hash() is kept.
        // display_name is the only name the app shows for a linked person; last_login_at is never shown.
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY,
            display_name  TEXT NOT NULL,
            email         TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_login_at TEXT
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
        // user_id links a trip member to an account; NULL for people without one.
        // name is what the trip's creator typed; a linked person shows users.display_name instead.
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS people (
            id      INTEGER PRIMARY KEY,
            name    TEXT NOT NULL,
            user_id INTEGER REFERENCES users (id)
        )
        SQL,
        // An email typed for a person that has no account yet. The first sign-up with it links the person.
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS trip_invites (
            person_id INTEGER PRIMARY KEY REFERENCES people (id) ON DELETE CASCADE,
            email     TEXT NOT NULL
        )
        SQL,
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS trip_members (
            trip_id   INTEGER NOT NULL REFERENCES trips (id),
            person_id INTEGER NOT NULL REFERENCES people (id),
            PRIMARY KEY (trip_id, person_id)
        )
        SQL,
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS expenses (
            id           INTEGER PRIMARY KEY,
            trip_id      INTEGER NOT NULL REFERENCES trips (id),
            name         TEXT    NOT NULL,
            spent_on     TEXT    NOT NULL,
            amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
            recorded_by  INTEGER NOT NULL,
            split_type   TEXT    NOT NULL CHECK (split_type IN ('equal', 'exact', 'percentage', 'shares')),
            created_at   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trip_id, recorded_by) REFERENCES trip_members (trip_id, person_id)
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
        // Marking a trip as paid or reopening it. The latest row is the trip's status (v_trip_status); no row means open.
        <<<'SQL'
        CREATE TABLE IF NOT EXISTS trip_status_changes (
            id         INTEGER PRIMARY KEY,
            trip_id    INTEGER NOT NULL REFERENCES trips (id),
            status     TEXT    NOT NULL CHECK (status IN ('paid', 'open')),
            changed_by INTEGER NOT NULL REFERENCES users (id),
            changed_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        SQL,
    ];

    private const array INDEXES = [
        'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)',
        'CREATE INDEX IF NOT EXISTS idx_people_user_id ON people (user_id)',
        'CREATE INDEX IF NOT EXISTS idx_trip_invites_email ON trip_invites (email)',
        'CREATE INDEX IF NOT EXISTS idx_trip_members_trip_id ON trip_members (trip_id)',
        'CREATE INDEX IF NOT EXISTS idx_trip_members_person_id ON trip_members (person_id)',
        'CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON expenses (trip_id)',
        'CREATE INDEX IF NOT EXISTS idx_expenses_trip_id_spent_on ON expenses (trip_id, spent_on)',
        'CREATE INDEX IF NOT EXISTS idx_expenses_recorded_by ON expenses (recorded_by)',
        'CREATE INDEX IF NOT EXISTS idx_expense_payers_expense_id ON expense_payers (expense_id)',
        'CREATE INDEX IF NOT EXISTS idx_expense_payers_person_id ON expense_payers (person_id)',
        'CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits (expense_id)',
        'CREATE INDEX IF NOT EXISTS idx_expense_splits_person_id ON expense_splits (person_id)',
        'CREATE INDEX IF NOT EXISTS idx_expense_changes_expense_id ON expense_changes (expense_id)',
        'CREATE INDEX IF NOT EXISTS idx_trip_status_changes_trip_id ON trip_status_changes (trip_id)',
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
                   e.trip_id,
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
        FROM trips t
        LEFT JOIN expenses e ON e.trip_id = t.id
        GROUP BY t.id
        SQL,
        'v_member_balances' => <<<'SQL'
        CREATE VIEW v_member_balances AS
        WITH paid AS (
            SELECT e.trip_id, p.person_id, SUM(p.amount_cents) AS paid_cents
            FROM expense_payers p
            JOIN expenses e ON e.id = p.expense_id
            GROUP BY e.trip_id, p.person_id
        ),
        shared AS (
            SELECT trip_id, person_id, SUM(share_cents) AS share_cents
            FROM v_expense_shares
            GROUP BY trip_id, person_id
        )
        SELECT m.trip_id,
               m.person_id,
               pe.name,
               COALESCE(paid.paid_cents, 0)                                  AS paid_cents,
               COALESCE(shared.share_cents, 0)                               AS share_cents,
               COALESCE(paid.paid_cents, 0) - COALESCE(shared.share_cents, 0) AS net_cents
        FROM trip_members m
        JOIN v_person_names pe ON pe.person_id = m.person_id
        LEFT JOIN paid ON paid.trip_id = m.trip_id AND paid.person_id = m.person_id
        LEFT JOIN shared ON shared.trip_id = m.trip_id AND shared.person_id = m.person_id
        SQL,
        // Each trip's current status: its latest status change, or 'open' without one.
        'v_trip_status' => <<<'SQL'
        CREATE VIEW v_trip_status AS
        SELECT t.id                       AS trip_id,
               COALESCE(s.status, 'open') AS status,
               s.changed_by,
               s.changed_at
        FROM trips t
        LEFT JOIN trip_status_changes s
               ON s.id = (SELECT MAX(id) FROM trip_status_changes WHERE trip_id = t.id)
        SQL,
        // Read model for listing expenses: one row per expense with its people as JSON arrays.
        'v_expense_list' => <<<'SQL'
        CREATE VIEW v_expense_list AS
        SELECT e.id,
               e.trip_id,
               e.name,
               e.spent_on,
               e.amount_cents,
               e.split_type,
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

    public static function apply(PDO $pdo): void
    {
        $pdo->beginTransaction();
        try {
            foreach ([...self::TABLES, ...self::INDEXES] as $sql) {
                $pdo->exec($sql);
            }
            foreach (array_reverse(array_keys(self::VIEWS)) as $view) {
                $pdo->exec("DROP VIEW IF EXISTS {$view}");
            }
            foreach (self::VIEWS as $sql) {
                $pdo->exec($sql);
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}
