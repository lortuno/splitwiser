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
