# Travel Expenses — walking skeleton

A Splitwise-style travel expense app reduced to the thinnest end-to-end slice:
**React Native (Expo, react-native-web) → plain PHP 8.4 API → SQLite**, with trips, people and expenses.
No authentication, accounts, settle-up payments or currency conversion.

## Run it

Only Docker is needed on the host.

```sh
docker compose up            # API on http://localhost:8080, web app on http://localhost:8081
```

The first start builds the image, creates the SQLite database in the `db-data` volume and seeds the demo
trip ("Lisbon & Porto": 4 people, 20 expenses over 7 days). The seed only runs when the database has no trips.

| Task | Command |
|---|---|
| Run all tests (PHP + TypeScript) | `docker compose run --rm app bun test` |
| Start API and web app in one container | `docker compose run --rm --service-ports app bun dev` (stop `docker compose up` first: same ports) |
| Build the iOS and Android JS bundles | `docker compose run --rm app bun run export:native` |
| Type-check the app | `docker compose run --rm app bun run typecheck` |
| Reset the database to the seed | `docker compose down -v && docker compose up` |

`bun test` is Bun's built-in test runner: it runs `packages/app/**/*.test.ts` and `tests/php.test.ts`,
which starts the PHP suite (`php packages/api/tests/run.php`). After changing dependencies, rebuild with
`docker compose build && docker compose up -V` so the `node_modules` volume is refreshed.

On a phone (Expo Go), set `EXPO_PUBLIC_API_URL` to an address the phone can reach, e.g. `http://192.168.1.20:8080`.

## Layout

```
package.json, bun.lock         all JS dependencies (exact versions); Expo project root (app.json)
docker/Dockerfile              one dev image: PHP 8.4.27 CLI + pdo_sqlite, Bun, Node
docker-compose.yml             services api (php -S) and app (Expo), volumes db-data and node_modules
scripts/dev.ts                 `bun dev`: starts both servers
tests/php.test.ts              runs the PHP suite from `bun test`
packages/api/
  public/index.php             front controller
  bin/init-db.php              schema + seed-if-empty
  src/Api/                     Router, Request, JsonResponse, controllers (HTTP <-> DTO only)
  src/Dto/                     immutable data objects serialized to JSON
  src/Repository/              SQL only
  src/Service/                 rules: validation, create/preview, summary, settlement
  src/Database/                connection, schema (tables, indexes, views), seeder
  tests/                       plain-PHP test runner and tests
packages/app/
  index.ts, src/App.tsx        entry point and screen switching
  src/api/                     fetch wrappers per resource
  src/dto/                     TypeScript types mirroring the API DTOs
  src/money/                   cent formatting and input parsing (+ tests)
  src/screens/                 Trip, Balances, Add expense
  src/components/              Card, Chip, FieldError, Money, TabBar
  src/i18n/                    UI strings (English); add a locale with the same keys
```

## Concepts

- **Trip members**: the people on a trip.
- **Paid by**: one or more members who handed over money, each with the amount they paid. They add up to the expense amount.
- **Split between**: the members who bear the cost — any subset, or a single person for a personal purchase —
  split **equally**, by **exact amounts**, by **percentages** or by **shares**. The shares add up to the expense amount.
- **Recorded by**: the member who entered the expense; they do not have to pay or share.
- **Net balance** = paid − share. **Transfers** are the fewest payments that bring every balance to zero.

## Money

- One currency, euros (`App\Money::CURRENCY`). There is no currency field anywhere.
- Every amount is an **integer number of cents** in SQLite, the API and the app. Percentages are basis points (33,33 % = 3333).
- The app converts only at the edges: input `"12,50"` or `"12.50"` → `1250`; display `1250` → `"12,50 €"`
  (comma decimals, always two of them, `.` thousands). The app never calculates money; it shows what the API returns,
  including the split preview, which comes from `POST /trips/{id}/expenses?dry_run=1`.

### Rounding rule

For every split type each person first gets `floor(amount × weight / total weight)`
(weight = 1 for equal, the cents for exact, basis points for percentage, units for shares).
The leftover cents are handed out **one each, to the largest remainders first; ties go to the lowest person id**.
People are always ordered by id, so the same input gives the same result regardless of order.
Example: 100,00 € split equally between persons 1, 2, 3 → 33,34 € / 33,33 € / 33,33 €.

## Data model

Two kinds of objects, so it is always clear where a displayed number comes from:

**Input tables** — only what a user states:

| Table | Content | Indexes |
|---|---|---|
| `trips` | name, start/end date | PK |
| `people` | name | PK |
| `trip_members` | trip ↔ person | `trip_id`, `person_id` |
| `expenses` | trip, name, date, amount, recorded by, split type | `trip_id`, `(trip_id, spent_on)`, `recorded_by` |
| `expense_payers` | paid by: person + amount | `expense_id`, `person_id` |
| `expense_splits` | split between: person + raw split value | `expense_id`, `person_id` |

**Calculated views** — derived by SQL, never written to (recreated on every start):

| View | Content |
|---|---|
| `v_expense_shares` | each person's share of an expense in cents (rounding rule above, via window functions) |
| `v_trip_totals` | total spend and expense count per trip |
| `v_member_balances` | paid, share and net per trip member |
| `v_expense_list` | expense rows with recorder, payers and shares as JSON, for listing |

Only the debt simplification runs in PHP (`SettlementService`): it is an optimisation search, exact up to 15 people
(largest number of zero-sum groups, bitmask search) with a greedy fallback above that.

## API

All money fields are integer cents. Validation errors are `422 {"errors": {"<field>": {"code", "message"}}}`
with field keys `name`, `date`, `amount_cents`, `recorded_by`, `paid_by`, `paid_by.<person_id>`, `split`, `split.<person_id>`.
The `code` is stable so the app can translate messages later.

| Method | Path | Response |
|---|---|---|
| GET | `/trips` | trips with `total_cents` |
| GET | `/trips/{id}` | trip with `members` |
| GET | `/trips/{id}/expenses` | expenses (newest first) with `recorded_by`, `paid_by`, `split_between` |
| POST | `/trips/{id}/expenses` | `201 {expense, summary}` — the updated summary comes with it |
| POST | `/trips/{id}/expenses?dry_run=1` | `200 {split_between}` — calculated split, nothing saved |
| GET | `/trips/{id}/summary` | `{currency, total_cents, expense_count, balances, transfers}` |

```json
POST /trips/1/expenses
{
  "name": "Bike rental in Foz",
  "date": "2026-06-06",
  "amount_cents": 4590,
  "recorded_by": 1,
  "paid_by": [{ "person_id": 2, "amount_cents": 2500 }, { "person_id": 3, "amount_cents": 2090 }],
  "split": { "type": "percentage", "between": [
    { "person_id": 1, "value": 5000 }, { "person_id": 2, "value": 3000 }, { "person_id": 3, "value": 2000 }
  ] }
}
```

## Versions

Every image and package is pinned: `php:8.4.27-cli-trixie` (includes the fixes for the critical PHP flaws
disclosed on 2026-10-21), `oven/bun:1.4.3-debian`, `node:22.23.4-trixie-slim`, Expo SDK 58 (`expo@58.0.19`,
`react-native@0.88.0`, `react@19.3.0`, `react-native-web@0.21.4`).
