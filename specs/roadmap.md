# Roadmap: shared travel expenses

Status: big picture only. Each epic is refined into its own spec (and gets its row in `docs/estimates.md`) before work starts.

## Starting point

The walking skeleton stays and every epic builds on it: the seeded demo trip in SQLite, the PHP API with split, balance
and transfer calculations in integer euro cents, the trip screen, the balances screen and the add expense form, all
running with `docker compose up`. Rules from `specs/guidelines/architecture.md` and `specs/guidelines/ui.md` apply to
every epic; in particular all money maths stays in `packages/api`.

## Intent

A Splitwise-style app for a group of friends or family on a trip. Each person has their own login and sees their trips.
Opening a trip shows at a glance how much the group spent and who owes whom. Anyone logged in can create a trip, add the
people travelling and record expenses (name, date, amount, one or more payers, split equally, by exact amounts, by
percentages or by shares). The recorder is always the logged-in user. Expenses can be edited: the database keeps who,
when and what changed, the app shows only an "edited" label. A settled trip can be marked as paid; who did it is stored.
Mobile first, covered by tests, one codebase for iOS, Android and the web. **The trip view is the product.**

## Decisions from the interview

| Topic | Decision |
|---|---|
| Epic order | 1 Trip at a glance → 2 Login and my trips → 3 Create a trip → 4 Edit expenses and mark as paid |
| Hero view | Total spent on top, then "who pays whom" transfers, then the expense list. Per-person balances stay on the Balances tab. |
| Login | Email + password (`password_hash`), opaque session token stored in SQLite, sent as a Bearer header. No new service. |
| Accounts | Sign-up screen (name, email, password). Seeded demo users have known passwords for the demo and tests. |
| Trip people | Added by name. An optional email links the member to the account with that email, now or when it signs up later; the trip then appears in that person's list. No mail is sent. |
| Paid trip | Marking as paid shows balances as settled and locks the trip (no new or edited expenses). Any member can reopen it. Who and when is stored for both. |
| Playwright | Added in epic 1, with Chromium installed in the existing dev image (`docker/Dockerfile`); no new service. Inventory updated in the same commit. Screenshot tests live in `tests/e2e`. |

## Definition of done (every epic)

- Works end to end in the browser after `docker compose up`, without any later epic.
- Still builds for iOS and Android (Expo export for both platforms succeeds in the container).
- PHP tests for every new rule or endpoint (`packages/api/tests`, run through `tests/functional`), TypeScript unit tests
  in `tests/unit` for app-side parsing and formatting, and a Playwright screenshot at a 390x844 mobile viewport.
- `docker compose run --rm app bun test` is green; the architecture and UI rule checks still pass.

---

## Epic 1: Trip at a glance

The hero view. Small on purpose: one screen, about 30 minutes for an agent, no login, no new API maths.

- **What a person can do afterwards:** open the app and see in one look how much the group has spent and who has to pay
  whom to settle up, without switching to the Balances tab.
- **On screen when done:** the trip screen of the seeded demo trip shows the trip name, the total spent in hero type,
  the "who pays whom" transfer rows (from → to, amount), or a clear "all settled" line when there are none, followed by
  the existing expense list and the "+ Add expense" button at the bottom. Data comes from the existing
  `GET /trips/{id}/summary`.
- **How it is tested:**
  - PHP: a functional test that the summary for the seeded trip returns the expected total and transfers (guarding the
    contract the screen relies on).
  - TypeScript: unit test for any new display helper (e.g. transfer row text).
  - Playwright (new in this epic): load the app at 390x844, assert the total and at least one transfer row are visible
    above the fold, save a screenshot.
- **Out of scope:** login, trip list, trip creation, editing, marking as paid, changes to per-person balances, any new
  calculation or endpoint.

## Epic 2: Login and my trips

- **What a person can do afterwards:** sign up or log in with their own account, see the list of trips they are a member
  of, open any of them in the epic 1 trip view, and record expenses as themselves.
- **On screen when done:** a login screen (email, password) with a link to a sign-up screen (name, email, password); after
  login a "My trips" list (name, dates, total per trip) that opens the trip view; a log-out action. The add expense form
  no longer has a "Recorded by" picker: the API sets the recorder from the session.
- **How it is tested:**
  - PHP: sign-up validation (duplicate email, weak input), login success/failure, token required on every trip endpoint
    (401 without, 403 for a trip the user is not a member of), trip list scoped to the user, `recorded_by` taken from the
    token and any value sent by the client ignored. Seed stays deterministic with demo users and at least two trips.
  - TypeScript: unit tests for the session/token handling in `src/api`.
  - Playwright: log in as a demo user at 390x844, screenshot "My trips", open a trip and see the epic 1 view; a second
    user does not see the first user's private trip.
- **Out of scope:** password reset, email verification, social login, creating trips, editing expenses, roles beyond
  "member of the trip".

## Epic 3: Create a trip

- **What a person can do afterwards:** start a new trip from scratch, add the people travelling, and immediately record
  expenses in it.
- **On screen when done:** a "New trip" action on "My trips" opens a form with trip name, start and end date, and a list
  of people: the logged-in user is added automatically, others are added by name with an optional email. Saving opens
  the new, empty trip view (total 0,00 €, all settled). A member whose email matches an account, now or at a later
  sign-up, sees the trip in their own list.
- **How it is tested:**
  - PHP: trip validation (name required, end not before start, no duplicate names in a trip), creator is a linked member,
    email linking at creation and at later sign-up, expenses can be recorded for name-only members.
  - TypeScript: unit tests for any form-side input parsing.
  - Playwright: at 390x844 create a trip with three people, screenshot the empty trip view, add one expense and see the
    total and transfers update; log in as a linked member and see the trip in their list.
- **Out of scope:** editing or deleting a trip, adding or removing people after creation, invitations or mail of any
  kind, merging a name-only member with an account by hand.

## Epic 4: Edit expenses and mark a trip as paid

- **What a person can do afterwards:** correct a saved expense, and close a trip once everyone has settled up (or reopen
  it if something was missed).
- **On screen when done:** tapping an expense opens it in the existing form, prefilled; saving updates the trip view and
  the expense shows a small "edited" label. The trip view has a "Mark as paid" action: afterwards the trip reads as
  settled (balances shown as settled, no open debt), the add and edit actions are gone, and a "Reopen" action is
  available. "My trips" shows paid trips as settled.
- **How it is tested:**
  - PHP: an edit stores a change record with the logged-in user, the time and the before/after values; only members can
    edit; edits recalculate shares, balances and transfers; the API exposes only an `edited` flag. Marking as paid and
    reopening store who and when from the session; a paid trip rejects new and edited expenses; summary reports the trip
    as settled.
  - TypeScript: unit tests for any new app-side mapping (e.g. prefilling the form from an expense DTO).
  - Playwright: at 390x844 edit an expense and screenshot the "edited" label; mark the trip as paid and screenshot the
    settled trip view.
- **Out of scope:** showing the change history in the app, deleting expenses, recording individual settle-up payments,
  partial settlement, notifications.
