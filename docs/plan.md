# Plan: Walking skeleton – travel expense splitter

Status: **implemented** (initial commit `b94a7be`). This document consolidates the approved plan (three review rounds)
with the decisions made during implementation, so it describes what is actually in the repository.

## Context

Goal: the thinnest end-to-end slice proving **React Native (Expo, web via react-native-web) → plain PHP 8.4 API → SQLite**,
with trips, people and expenses. No authentication, user accounts, settle-up payments, currency conversion or other features.

Constraints from the brief:

- Two packages: `packages/app` (Expo + TypeScript, one codebase for iOS, Android and web) and `packages/api`
  (PHP 8.4, PDO SQLite, no framework, no ORM).
- All JS dependencies in the root `package.json`; PHP dependencies (none so far) only in `packages/api/composer.json`.
- Everything runs in Docker with pinned image versions; a fresh clone plus `docker compose up` is enough.
- Euros only, money as integer cents everywhere; the app converts only at the edges and never calculates money.
- All code and documentation in English; UI text ready to be translated later.

Review changes that shaped the plan:

1. Code organised by purpose (Dto / Repository / Service / Api) instead of a flat `src/`.
2. Data model split into **input tables** (what the user states) and **calculated SQL views** (everything derived).
3. Indexes on the tables; money always displayed with `,` and exactly two decimals.
4. Clear expense roles (**Paid by** / **Split between** / **Recorded by**) instead of "payers vs participants".
5. PHP pinned to a release that includes the fix for the critical flaws disclosed on 2026-10-21.

## Expense roles

Terminology used in the DB, API, UI and docs:

- **Trip members**: the people on the trip.
- **Paid by**: one or more members who handed over money, each with the amount they paid. Σ = expense amount.
- **Split between**: the members who bear the cost: any subset, or a single person for a personal purchase,
  split equally / by exact amounts / by percentages / by shares. Σ shares = expense amount.
- **Recorded by**: the member who entered the expense; they do not need to be in either list.

Example: *Dinner 60,00 €, paid by Ben, split equally between Ana, Ben and Chloé, recorded by David*
→ Ben +40,00 €, Ana −20,00 €, Chloé −20,00 €, David 0,00 €.

## Key decisions

1. **Expo project root = repo root.** `app.json`, `tsconfig.json` and the only `package.json` are at the root;
   `"main": "packages/app/index.ts"`. This keeps all JS dependencies in the root manifest, where Expo/Metro expect them.
2. **One dev image, two services.** `docker/Dockerfile` is based on `php:8.4.27-cli-trixie` (pdo_sqlite built in, SQLite 3.46),
   with the `bun` binary from `oven/bun:1.4.3-debian` and `node` from `node:22.23.4-trixie-slim` (Expo CLI/Metro run on Node).
   `api` and `app` share it so `bun dev` and `bun test`, which need PHP and Bun together, work in either container.
   Trixie is used because `json_group_array(... ORDER BY ...)` needs SQLite ≥ 3.44.
3. **`bun test` runs Bun's built-in runner**, never a package script. TypeScript tests are `*.test.ts`;
   `tests/php.test.ts` starts `php packages/api/tests/run.php` and fails on a non-zero exit. `bun dev` → `scripts/dev.ts`.
4. **Split maths has one home: the `v_expense_shares` SQL view.** PHP validates input and computes the debt simplification only.
5. **Split preview without app-side maths:** `POST /trips/{id}/expenses?dry_run=1` validates, inserts in a transaction,
   reads `v_expense_shares` and rolls back.
6. **No PHP dependencies:** a small autoloader in `bootstrap.php` and a plain-PHP test runner; no `composer.json`.
7. **Rounding rule:** each person gets `floor(amount × weight / Σweight)`; leftover cents go one each to the largest
   remainders, ties to the lowest person id. Weights: 1 (equal), cents (exact), basis points (percentage), units (shares).
   Input order never changes the result.
8. **Fewest transfers:** exact up to 15 people with a non-zero balance (bitmask search for the largest number of
   zero-sum groups; transfers = people − groups), greedy fallback above that. Inside a group the largest debtor pays
   the largest creditor; ties go to the lower person id.
9. **Money display:** integer cents in storage and API; `formatCents` always gives `,` decimals, two places,
   `.` thousands and a non-breaking space before `€` (`123456 → "1.234,56 €"`). Percentages: `3333 → "33,33 %"`.

## Data model (SQLite)

### Input tables

| Table | Columns | Indexes |
|---|---|---|
| `trips` | id, name, start_date, end_date | PK |
| `people` | id, name | PK |
| `trip_members` | trip_id, person_id, PK(trip_id, person_id) | `trip_id`, `person_id` |
| `expenses` | id, trip_id, name, spent_on, amount_cents > 0, recorded_by, split_type, created_at; FK (trip_id, recorded_by) → trip_members | `trip_id`, `(trip_id, spent_on)`, `recorded_by` |
| `expense_payers` | expense_id, person_id, amount_cents > 0 | `expense_id`, `person_id` |
| `expense_splits` | expense_id, person_id, split_value (NULL / cents / basis points / units) | `expense_id`, `person_id` |

`PRAGMA foreign_keys = ON`, WAL mode. Tables use `CREATE … IF NOT EXISTS`; views are dropped and recreated on every start.

### Calculated views (never written to)

| View | Content |
|---|---|
| `v_expense_shares` | share in cents per person and expense (window functions implementing the rounding rule) |
| `v_trip_totals` | total_cents and expense_count per trip |
| `v_member_balances` | paid, share and net per trip member |
| `v_expense_list` | expense rows with recorder name, payers and shares as JSON arrays |

## API (`packages/api`)

```
public/index.php          front controller
bootstrap.php             autoloader
bin/init-db.php           Schema::apply() + Seeder::seedIfEmpty()
src/Container.php         composition root
src/Money.php             CURRENCY = 'EUR', format() for messages
src/Api/                  Router, Routes, Request, JsonResponse (CORS), Trip/Expense/SummaryController
src/Dto/                  Trip, Person, Expense, Payer, SplitShare, SplitEntry, SplitType, NewExpense,
                          Balance, Transfer, TripSummary
src/Repository/           TripRepository, PersonRepository, ExpenseRepository, BalanceRepository (SQL only)
src/Service/              ExpenseValidator, ExpenseService (create / preview), SummaryService,
                          SettlementService, ValidationException, NotFoundException
src/Database/             Connection, Schema, Seeder
tests/                    run.php + Split, Rounding, MultiPayer, PersonalPurchase, Recorder,
                          TripTotal, Settlement, Seed tests
```

| Method | Path | Response |
|---|---|---|
| GET | `/trips` | trips with `total_cents` |
| GET | `/trips/{id}` | trip with `members` |
| GET | `/trips/{id}/expenses` | expenses (newest first) with `recorded_by`, `paid_by`, `split_between` |
| POST | `/trips/{id}/expenses` | `201 {expense, summary}` |
| POST | `/trips/{id}/expenses?dry_run=1` | `200 {split_between}`; nothing saved |
| GET | `/trips/{id}/summary` | `{currency, total_cents, expense_count, balances, transfers}` |

Request body: `{name, date, amount_cents, recorded_by, paid_by: [{person_id, amount_cents}], split: {type, between: [{person_id, value}]}}`.
Validation errors: `422 {"errors": {"<field>": {"code", "message"}}}` with keys `name`, `date`, `amount_cents`,
`recorded_by`, `paid_by`, `paid_by.<person_id>`, `split`, `split.<person_id>`. The `code` is stable for future translation.

## Seed

Deterministic literal data in `Seeder.php`: trip "Lisbon & Porto" (2026-06-01 to 2026-06-07), members Ana, Ben, Chloé, David,
20 expenses ("Dinner at the harbour", "Train to Porto", "Museum tickets", "Airbnb Porto, 3 nights", …) covering all four split
types, 5 multi-payer expenses, 9 recorded by someone who did not pay, one personal purchase and amounts that need rounding.
Inserted through `ExpenseService`, so the normal validation applies. Runs only when the database has no trips.

## App (`packages/app`)

```
index.ts                  registerRootComponent
src/App.tsx               loads the first trip, holds state, switches screens
src/api/                  client.ts (EXPO_PUBLIC_API_URL ?? http://localhost:8080), trips.ts, expenses.ts
src/dto/                  TypeScript types mirroring the API DTOs
src/money/                format.ts, parse.ts (+ tests) — string/integer only, no floats
src/screens/              TripScreen, BalancesScreen, AddExpenseScreen
src/components/           Card, Chip, FieldError, Money, TabBar
src/i18n/                 en.ts dictionary + t() and formatDate()
src/theme.ts              colours, spacing, 48 px touch target
```

- Core React Native components only; no UI kit, icon library, external images or navigation library.
- Bottom tab bar (Expenses / Balances / + Add expense) for one-thumb use; max width 520 px on web.
- **Trip screen:** total spend card, then expenses with name, date, amount, paid by, recorded by and split.
- **Balances screen:** paid / share / net per person (sign and colour) and the transfers list.
- **Add expense:** recorded by, name, date (defaults to today, clamped to the trip dates), amount, paid by (an amount per
  payer when more than one), split between, split type, per-person values and a live preview from the dry-run call.
  API errors show under their field and clear when the field is edited. Saving uses `{expense, summary}` from the
  response; no second request.

## Docker and scripts

- `docker-compose.yml`: `api` (`php bin/init-db.php && php -S 0.0.0.0:8080 …`, health check) and `app`
  (`bunx expo start --port 8081`; `--web` is not used because it tries to open a browser in the container).
  Bind mount `.:/app`, named volumes `node_modules` and `db-data` (SQLite at `/data/app.sqlite`).
- Root scripts: `dev`, `web`, `api`, `export:native`, `typecheck`; `bun test` is the built-in runner.

## Pinned versions

| Component | Version |
|---|---|
| PHP image | `php:8.4.27-cli-trixie` |
| Bun image | `oven/bun:1.4.3-debian` |
| Node image | `node:22.23.4-trixie-slim` |
| Expo | `expo@58.0.19`, `@expo/metro-runtime@58.0.15` |
| React / React Native | `react@19.3.0`, `react-dom@19.3.0`, `react-native@0.88.0`, `react-native-web@0.21.4` |
| Dev | `typescript@6.0.3`, `@types/react@19.3.0`, `@types/bun@1.4.3` |
| Playwright (verification only, not in the repo) | `mcr.microsoft.com/playwright/python:v1.64.1-noble` + `playwright==1.64.1` |

## Verification (done)

1. `docker compose down -v && docker compose build && docker compose up`: database created and seeded; API returns
   20 expenses, total 1.915,57 €, nets summing to zero, 3 transfers.
2. `docker compose run --rm app bun test`: 33 PHP tests and the TypeScript money tests pass; `tsc --noEmit` is clean.
3. `docker compose run --rm app bun run export:native`: iOS and Android Hermes bundles build (no Xcode/Gradle builds).
4. `docker compose run --rm --service-ports app bun dev`: both servers start.
5. Playwright at 390×844: trip, balances and add-expense screens; an expense recorded by Ana, paid by Ben and Chloé,
   split 50/30/20 by percentage updates the total (→ 1.961,47 €) and balances with a single POST.

## Known limitations

- No safe-area library: a fixed top inset is used on iOS/Android; not checked on a real device.
- On a phone, `EXPO_PUBLIC_API_URL` must point to the host's LAN address.
- Only one trip is shown (the first); there is no trip picker yet.
- Changing dependencies requires `docker compose build && docker compose up -V` to refresh the `node_modules` volume.
