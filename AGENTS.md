# AGENTS.md

Stack: Expo (React Native + react-native-web, TypeScript) → plain PHP 8.4 API → SQLite, run with Docker and Bun.

## Commands
- Start everything: `docker compose up` (API http://localhost:8080, app http://localhost:8081)
- API and app in one container: `docker compose run --rm --service-ports app bun dev`
- All tests (PHP + TypeScript): `docker compose run --rm app bun test`
- One group: `docker compose run --rm app bun test tests/unit` (app, pure TS), `tests/functional` (PHP API + SQLite) or `tests/hooks` (Claude Code hooks). Each kind of test lives only in its own folder.

## Before you change things
- Read `specs/guidelines/architecture.md` before adding a package, service or dependency.
- Read `specs/guidelines/ui.md` before building a screen.

## Estimates
Every feature starts with an estimate and ends with the real time spent, so estimates get better over time. Log: `docs/estimates.md`. Enforced by `.claude/hooks/estimate-guard.ts`.
- Unit: hours of development time only, while the ticket moves from To Do through Ready for Dev and In Progress to Ready to Deploy. Manual QA and deployment windows are not included.
- Before starting: append a row with the date, the feature and the estimated hours, leaving Actual empty. Confirm the estimate with the user. Without an open row, nothing under `packages/` or `tests/` can be changed.
- When the feature reaches Ready to Deploy: ask the user for the real development hours and fill in Actual. A new estimate cannot be added while another one is open.
- Rows are append-only: an estimate or a recorded actual is never changed or removed. Hours are numbers greater than 0 (`0.5`, `3`, `12`).
