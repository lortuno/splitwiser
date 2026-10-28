# AGENTS.md

Stack: Expo (React Native + react-native-web, TypeScript) → plain PHP 8.4 API → SQLite, run with Docker and Bun.

## Commands
- Start everything: `docker compose up` (API http://localhost:8080, app http://localhost:8081)
- API and app in one container: `docker compose run --rm --service-ports app bun dev`
- All tests (PHP + TypeScript): `docker compose run --rm app bun test`
- One group: `docker compose run --rm app bun test tests/unit` (app, pure TS), `tests/functional` (PHP API + SQLite), `tests/hooks` (Claude Code hooks) or `tests/e2e` (Playwright in Chromium at 390x844; starts its own seeded API and web export, screenshots in `test-results/e2e/`). Each kind of test lives only in its own folder.

## Specs
- Every feature belongs to a category and has one living specification in that category's folder: `specs/{category}/{nr}-{name}-specification.md` (e.g. `specs/translations/06-translations-specification.md`), next to its brainstorming and progress files. The specification is the source of truth: a change to a feature edits it in place, with no change log in it; git keeps the history. Never start a second spec for a feature that has one.
- Specify an epic, a new feature or a change to a feature with `/spec {epic number, feature or change}` (`.claude/skills/spec/SKILL.md`). It appends one round at a time to the feature's `-brainstorming.md`, waits for the user's answers in that file, then writes the specification or edits the existing one. Enforced by `.claude/hooks/spec-guard.ts` (the folder layout and one spec per feature always; the brainstorming loop while `/spec` runs).

## Before you change things
- Read `specs/guidelines/architecture.md` before adding a package, service or dependency.
- Read `specs/guidelines/ui.md` before building a screen.
- In `specs/{category}/{nr}-{name}-progress.md`, tick a build step (Screens, Data, API, Seed data, Tests) as soon as it is built, so the status line bar moves during the build. Tick a check only after it passes in the browser and its test is green.

## Estimates
Every feature starts with an estimate and ends with the real time spent, so estimates get better over time. Each feature keeps its own log: the `## Estimate` table (`| Date | Task | Estimate (h) | Actual (h) |`) near the top of `specs/{category}/{nr}-{name}-specification.md`, so every task of an epic, and every later change to the feature, is logged against that feature and features can be estimated in parallel. Work outside an epic (status line, hooks, skills) goes in `specs/tooling/00-tooling-specification.md`. Enforced by `.claude/hooks/estimate-guard.ts`.
- Unit: hours of development time only, while the ticket moves from To Do through Ready for Dev and In Progress to Ready to Deploy. Manual QA and deployment windows are not included.
- Before starting: append a row to the feature's table with the date, the task and the estimated hours, leaving Actual empty. Add the `## Estimate` section (right after the source lines) if the spec has none yet. Confirm the estimate with the user. Without an open row in some spec, nothing under `packages/` or `tests/` can be changed.
- When the task reaches Ready to Deploy: ask the user for the real development hours and fill in Actual. A spec cannot get a new estimate while one of its rows is open; other specs can.
- Rows are append-only: an estimate or a recorded actual is never changed or removed. Hours are numbers greater than 0 (`0.5`, `3`, `12`).
