# Architecture

**Stack:** Expo (React Native + react-native-web, TypeScript) → plain PHP 8.4 API (no framework, no ORM) → SQLite, all in Docker.
**Why:** exportable (moves to any machine with Docker), universal (one codebase for iOS, Android and web), straightforward (no framework, no ORM), easy to optimise, and the team already knows how to handle it.

## Packages and what they own
- `packages/app`: screens, components, UI text (`src/i18n`), parsing input to cents and formatting cents for display (`src/money`). Owns no data and no money maths.
- `packages/api`: HTTP routes, validation, schema (input tables + `v_*` views), seed, settlement. The only package that opens the database.
- Repo root: `package.json` + `bun.lock` (all JS deps), `app.json`, `docker/`, `docker-compose.yml`, `scripts/`, `tests/` (`unit/`, `functional/`, `hooks/`).

## Request flow
1. A screen calls `src/api/*`, which sends JSON with integer cents to `EXPO_PUBLIC_API_URL`.
2. `public/index.php` → `Api/Router` → controller (HTTP ↔ DTO) → `Service/*` (validation, rules) → `Repository/*` (SQL only).
3. Repositories write input tables only and read derived numbers from the `v_*` views.
4. DTOs are returned as JSON in cents; the app formats them with `src/money/format.ts`. A write returns the updated summary in the same response.

## Rules (each line ends with its check)
1. Only `packages/api` touches SQLite. Check: `grep -rniE "sqlite|PDO" packages/app scripts` finds nothing.
2. JS dependencies live only in the root `package.json`. Check: `find packages -name package.json` finds nothing.
3. PHP dependencies live only in `packages/api/composer.json`. Check: `find . -name composer.json -not -path ./packages/api/composer.json -not -path "*/node_modules/*" -not -path "./packages/api/vendor/*"` finds nothing.
4. Versions are exact. Check: no `^`, `~`, `*` or `latest` in `package.json`; every `FROM`/`image:` tag has a full `x.y.z` version.
5. Money is integer euro cents in the DB, the API and the app, never floats. Check: money columns and JSON fields end in `_cents` and are `INTEGER`/`int`; `grep -rnE "parseFloat|toFixed|Math\.round" packages/app/src` finds nothing.
6. Splits, balances, trip totals and transfers are calculated only in `packages/api`. Check: `grep -rnE "_cents\s*[-+*/]|[-+*/]\s*\w+\.\w+_cents" packages/app/src` finds nothing; the split preview comes from `?dry_run=1`.
7. Euros are the only currency. Check: the code `EUR` appears only in `Money::CURRENCY` (`packages/api/src/Money.php`); the symbol `€` appears in `packages/app/src` only in `money/format.ts` (`CURRENCY_SYMBOL`) and in `*.test.ts`.
8. Leftover cents go to the largest remainder first, ties to the lowest person id. This is implemented only in `v_expense_shares` (`Database/Schema.php`). Check: `RoundingTest` passes.
9. The demo seed is deterministic. Check: no `rand`, `random_int`, `uniqid`, `time()` or `date()` in `Seeder.php`; `SeedTest › seed is deterministic` passes.
10. A clean machine needs only Docker. Check: `docker compose down -v && docker compose up` serves the seeded trip at http://localhost:8081.
11. No new package, service, volume, image or dependency without an entry under Inventory, in the same commit. Check: each name in `package.json`, `composer.json` and `docker-compose.yml` appears below.

## Inventory
- Services: `api`, `app`, `mailpit` (local SMTP and inbox for the sign-up codes, feature 8). Volumes: `node_modules`, `api_vendor` (the API's Composer packages). The database is bind-mounted from `packages/api/var` (git-ignored).
- Images: `php:8.4.27-cli-trixie`, `oven/bun:1.4.3-debian`, `node:22.23.4-trixie-slim`, `composer:2.10.2` (build stage: installs the API's packages and provides `composer audit`), `axllent/mailpit:v1.31.5`.
- JS: `expo`, `@expo/metro-runtime`, `react`, `react-dom`, `react-native`, `react-native-web`; dev: `typescript`, `@types/react`, `@types/bun`, `playwright` (Chromium installed in `docker/Dockerfile`, for the screenshot tests in `tests/e2e`).
- PHP: `symfony/mailer` (sends the sign-up codes over SMTP; its own dependencies are pinned in `packages/api/composer.lock`).
