# Epic 4: Edit expenses and mark a group as paid — specification

Source: `specs/roadmap.md`, epic 4. Brainstorming: `specs/expenses/04-edit-expenses-and-mark-as-paid-brainstorming.md` (rounds
1–3; the answers to rounds 1 and 2 were given in the chat and are recorded at the top of rounds 2 and 3).
Boundaries: `specs/guidelines/architecture.md`, `specs/guidelines/ui.md`.

## Estimate

Development hours only, as defined in "Estimates" in AGENTS.md. Rows are append-only.

| Date | Task | Estimate (h) | Actual (h) |
|---|---|---|---|
| 2026-10-28 | Build the epic | 2 | 0.25 |

## Goal

Any member can correct a saved expense. The edit form is the add expense form, prefilled. Saving recalculates
shares, balances and transfers in the API. The database keeps who changed what and when, as before/after snapshots,
and the app shows only an "Edited" label. Any member can mark a group as paid once everyone has settled up outside the
app, or reopen it. Who did it and when is stored for both actions. A paid group reads as settled and is locked: no new
or edited expenses until someone reopens it. No new package, service or dependency.

## Screens

All buttons are at least `size.tapMin` (48 px) high. Primary buttons are `size.tapPrimary` (56 px) high and sit at the
bottom. There are no browser dialogs: the confirmation is an in-app screen.

### Group view, open group (`TripView` / `TripScreen`, changed)

```
┌──────────────────────────────────────┐
│ ‹ My groups            Mark as paid  │  two text buttons, 48 high, accent
│ Lisbon & Porto                       │  group name, title 20, 1 line, "…"
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ Total spent                 │ │  total card unchanged
│ │ 1.915,57 €                       │ │
│ │ 1 Jun 2026 – 7 Jun 2026 · 20 exp…│ │
│ └──────────────────────────────────┘ │
│ Who owes whom                        │  unchanged
│ …                                    │
│ Expenses                             │
│ ┌──────────────────────────────────┐ │  each row is now a button
│ │ Taxi to Porto airport   31,50 € ›│ │  (whole card, ≥ 48 high);
│ │ 7 Jun 2026 · Paid by David       │ │  "›" hints it opens
│ │ Recorded by Chloé · Split betw…  │ │
│ │ Edited                           │ │  caption, inkMuted, only when
│ └──────────────────────────────────┘ │  edited: true
├──────────────────────────────────────┤
│ [ Group  ] [Balances] [+ Add expense]│  tab bar unchanged
└──────────────────────────────────────┘
```

- **Mark as paid** (header, right, `size.tapMin`): opens the confirmation screen. It shows only on an open group, on
  the Group and Balances tabs.
- **Expense row** (whole card, `accessibilityRole="button"`, "›" at the right of the amount): opens "Edit expense" for
  that expense.
- **Edited** (caption, `inkMuted`, its own line under "Recorded by …"): shown when the API says `edited: true`.
- **Loading / error / not found / not a member:** unchanged from epics 1–2.

### Edit expense (`AddExpenseScreen` in edit mode, changed)

```
┌──────────────────────────────────────┐
│ Edit expense                 Cancel  │  title changes; Cancel as now
├──────────────────────────────────────┤
│ What was it?                         │  every field prefilled from the
│ ┌──────────────────────────────────┐ │  expense: name, date, amount
│ │ Taxi to Porto airport            │ │  (as "31,50"), payers and their
│ └──────────────────────────────────┘ │  amounts, split type, people
│ Date (YYYY-MM-DD)     Amount (€)     │  and their values ("33,33" for
│ ┌───────────────┐    ┌─────────────┐ │  percent, "2" for shares)
│ │ 2026-06-07    │    │ 31,50       │ │
│ └───────────────┘    └─────────────┘ │
│ Paid by   [Ana] [Ben] [Chloé] [David]│
│ Split between …                      │
│ How to split  [Equally] [Amounts] …  │
│ Split preview …                      │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │           Save changes           │ │  primary, 56 high, bottom;
│ └──────────────────────────────────┘ │  "Saving…" while busy
└──────────────────────────────────────┘
```

- **Prefill:** name; date; amount as plain input without thousands separators (`3150` → "31,50", `100000000` →
  "1000000,00"); payers selected, and with several payers each amount as "12,50"; split type; people in "Split
  between" selected, with values as typed ones would be. Exact amounts are "15,00", percentages are "33,33" (from basis
  points), and shares are whole numbers. A new helper in `src/money/format.ts` turns cents and basis points into these
  input strings, without floats.
- **Split preview:** unchanged (`POST /trips/{id}/expenses?dry_run=1`).
- **Save changes** (`size.tapPrimary`): `PUT /trips/{id}/expenses/{expenseId}`. While the request runs it reads
  "Saving…". `200` → back to the group view with the returned expense and summary. The row keeps its place by date and
  shows "Edited" when the API says so. `422` → the same field messages as the add form, and the input stays. `409
  trip_paid` → the owesSoft card "This group is marked as paid. Reopen it to make changes." above the button, and the
  input stays. API unreachable → the existing form error card, and the input stays.
- **Cancel:** back to the group view without saving. After a `409 trip_paid`, the group view reloads and shows the paid
  state.
- The tab bar is hidden, as for "+ Add expense". "+ Add expense" keeps its title "Add expense" and button "Save
  expense". After a `409 trip_paid` it shows the same card.

### Mark as paid confirmation (`MarkPaidScreen`, new, inside the group view)

```
┌──────────────────────────────────────┐
│ ‹ My groups                          │
│ Lisbon & Porto                       │
├──────────────────────────────────────┤
│ Mark this group as paid?             │  title 20 bold
│                                      │
│ These payments will be treated as    │  body
│ done:                                │
│ ┌──────────────────────────────────┐ │
│ │ Ana pays Ben             63,75 € │ │  every open transfer from the
│ │ David pays Ben           27,65 € │ │  summary, in API order (not
│ │ David pays Chloé         27,07 € │ │  only the first 3)
│ └──────────────────────────────────┘ │
│ Nobody can add or change expenses    │  caption, inkMuted
│ until the group is reopened.         │
│                                      │
│            (flexible space)          │
│ ┌──────────────────────────────────┐ │
│ │           Mark as paid           │ │  primary, 56 high, bottom
│ └──────────────────────────────────┘ │
│              Cancel                  │  text button, 48 high
└──────────────────────────────────────┘
```

- With no open transfers, the list and its intro are replaced by "Everyone is settled up."
- **Mark as paid** (`size.tapPrimary`): `POST /trips/{id}/paid`. While the request runs it reads "Marking as paid…".
  `200` → the paid group view, built from the returned summary. `409 already_paid` → the group view reloads and shows
  the paid state. API unreachable → the owesSoft card "Could not reach the API at {url}." above the button, and nothing
  changes.
- **Cancel:** back to the group view, unchanged. The header's "Mark as paid" and the tab bar are hidden while this screen
  shows.

### Group view, paid group (changed)

```
┌──────────────────────────────────────┐
│ ‹ My groups                  Reopen  │  "Reopen" replaces "Mark as paid"
│ Lisbon & Porto                       │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ ✓ Paid                           │ │  accentSoft card, title bold
│ │ Marked as paid by Ana on         │ │  body
│ │ 28 Oct 2026.                     │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Total spent                 │ │  total card unchanged
│ │ 1.915,57 €                       │ │
│ └──────────────────────────────────┘ │
│                                      │  no "Who owes whom" section
│ Expenses                             │
│ ┌──────────────────────────────────┐ │  rows are NOT buttons
│ │ Taxi to Porto airport    31,50 € │ │  (no "›"); "Edited" still
│ │ …                                │ │  shows where it applies
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ [   Group    ] [    Balances    ]    │  no "+ Add expense"
└──────────────────────────────────────┘
```

- **✓ Paid card:** "Marked as paid by {paid.by.name} on {local date of paid.at}." `paid.by.name` is the marker's
  shown name on this group, so a later rename shows.
- **Reopen** (header, `size.tapMin`): `POST /trips/{id}/reopen` at once, with no confirmation. `200` → the open group
  view from the returned summary: "Who owes whom", tappable rows and "+ Add expense" are back. `409 already_open` → the
  group view reloads. API unreachable → the owesSoft card "Could not reach the API at {url}." at the top of the Group
  tab, and the group stays paid.
- The tab bar has only Group and Balances.

### Balances, paid group (`BalancesScreen`, changed)

- Each person keeps "Paid" and "Share" with their amounts. The "Net" amount is replaced by the word "Settled"
  (`inkMuted`). The API still sends the real `net_cents` (Round 1 Q6), and the app does not show them.
- "Who owes whom" shows "Everyone is settled up." instead of the transfers.
- An open group: unchanged.

### My groups (`MyTripsScreen`, changed)

```
│ ┌──────────────────────────────────┐ │
│ │ Lisbon & Porto            ✓ Paid │ │  "✓ Paid" chip, accentSoft,
│ │ 1 Jun 2026 – 7 Jun 2026          │ │  right of the name
│ │ Total                 1.915,57 € │ │
│ └──────────────────────────────────┘ │
```

- A paid group shows the "✓ Paid" chip (caption bold, `accent` on `accentSoft`, `radius.pill`) to the right of the
  name. The name still wraps to at most 2 lines. Paid groups sit in the "Paid groups" section at the bottom of the
  list, closed by default (`specs/accounts/02-login-and-my-groups-specification.md`).

## Data

**Schema changes** (`packages/api/src/Database/Schema.php`), as input tables, never updated or deleted:

- **`expense_changes`**: `id INTEGER PRIMARY KEY`, `expense_id INTEGER NOT NULL REFERENCES expenses (id) ON DELETE
  CASCADE`, `changed_by INTEGER NOT NULL REFERENCES users (id)`, `changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`,
  `before_json TEXT NOT NULL`, `after_json TEXT NOT NULL`. Index on `expense_id`.
- **`trip_status_changes`**: `id INTEGER PRIMARY KEY`, `trip_id INTEGER NOT NULL REFERENCES trips (id)`, `status TEXT
  NOT NULL CHECK (status IN ('paid', 'open'))`, `changed_by INTEGER NOT NULL REFERENCES users (id)`, `changed_at TEXT
  NOT NULL DEFAULT CURRENT_TIMESTAMP`. Index on `trip_id`.
- **Views:** `v_trip_status` gives each group's latest status row (highest `id`) with `status`, `changed_by` and
  `changed_at`. A group without rows is open. `v_expense_list` gets `edited` (1 when a change record exists).
- `expenses.recorded_by` and `created_at` never change on an edit.

**Snapshot shape** (`before_json` / `after_json`), the full input in one canonical form:
`{ name, date, amount_cents, paid_by: [{ person_id, amount_cents }], split: { type, between: [{ person_id, value }] } }`.
Lists are sorted by `person_id`, and `value` is `null` for an equal split. The before and after snapshots are compared
as JSON. When they are identical, nothing is written: no change record, no row update, and `edited` stays as it was.

**Writes:**
- Edit, in one transaction: update `expenses` (name, `spent_on`, `amount_cents`, `split_type`), replace its
  `expense_payers` and `expense_splits`, and insert one `expense_changes` row with the session's user id.
- Mark as paid / reopen: insert one `trip_status_changes` row (`paid` / `open`) with the session's user id.

**Reads:** `edited` for each expense. The current status for `GET /trips` and the summary. `paid.by` is the marker's
person on that group (shown name, `v_person_names`), and `paid.at` is `changed_at` as `YYYY-MM-DDTHH:MM:SSZ` (UTC).

**App:** `Expense.edited`, `Trip.paid`, `TripSummary.paid`. New `src/api/expenses.ts` `updateExpense`, and
`src/api/trips.ts` `markPaid` / `reopenTrip`. The edit prefill and its input formatting live in pure helpers (unit
tested). The app adds, subtracts and divides no money (architecture rule 6).

## API

Errors keep the existing shapes. All money is integer `_cents`. CORS `Access-Control-Allow-Methods: GET, POST, PUT,
PATCH, OPTIONS`.

| Request | Response |
|---|---|
| `PUT /trips/{id}/expenses/{expenseId}` (body as `POST /trips/{id}/expenses`) | `200 { expense, summary }`. `recorded_by` in the body is ignored, and the recorder never changes. Same `422` field errors as a new expense. |
| `POST /trips/{id}/paid` | `200 { summary }`, with `summary.paid` set. |
| `POST /trips/{id}/reopen` | `200 { summary }`, with `summary.paid: null`. |
| `GET /trips/{id}/summary` | Unchanged, plus `paid: { by: { id, name }, at }`, or `null` when the group is open. On a paid group, `balances` and `transfers` are the real calculated ones (the app hides them). |
| `GET /trips` | Each group gets `paid: true \| false`. |
| `GET /trips/{id}/expenses`, `POST /trips/{id}/expenses`, `PUT …/{expenseId}` | Each expense gets `edited: true \| false`. |

Errors for all of them, checked in this order:

1. `401 unauthenticated`: no or invalid token.
2. `404 not_found`: unknown group.
3. `403 not_a_member`.
4. `404 not_found`: the expense id does not exist on this group (also an expense of another group).
5. `409`, each as `{ error: { code, message } }`:
   - `trip_paid` ("This group is marked as paid. Reopen it to make changes."): `POST …/expenses` (also with
     `?dry_run=1`) or `PUT …/expenses/{expenseId}` on a paid group.
   - `already_paid` ("This group is already marked as paid."): `POST …/paid` on a paid group.
   - `already_open` ("This group is already open."): `POST …/reopen` on an open group.
6. `422`: field errors, exactly as for a new expense.

## Seed data

No seed changes. Groups 1–8 and the 10 accounts stay as they are, so every epic 1–3 check keeps its figures and the
first group created after the seed is still group 9. The checks edit and mark as paid through the app on the seeded
groups.

**Group 7 "Madrid weekend"** (Ana and Chloé), as seeded:

| Expense | Amount | Paid by | Split | Shares |
|---|---|---|---|---|
| Tapas at Mercado de San Miguel (recorded by Chloé) | `48,30 €` | Chloé | equally | Ana `24,15 €`, Chloé `24,15 €` |
| Prado Museum tickets (recorded by Ana) | `30,00 €` | Ana | equally | Ana `15,00 €`, Chloé `15,00 €` |

Total `78,30 €`, Ana pays Chloé `9,15 €`.

| After | Total | Shares that change | Balances | Transfer |
|---|---|---|---|---|
| Check 4: Tapas amount → `50,01 €` | `80,01 €` | Tapas: Ana `25,01 €`, Chloé `25,00 €` (Ana has the lower person id and gets the leftover cent) | Ana `-10,01 €`, Chloé `+10,01 €` | Ana pays Chloé `10,01 €` |
| Check 5: Prado split → Percent, Ana 70 %, Chloé 30 % | `80,01 €` | Prado: Ana `21,00 €`, Chloé `9,00 €` | Ana `-16,01 €`, Chloé `+16,01 €` | Ana pays Chloé `16,01 €` |

Marking as paid and reopening do not change these numbers. After check 14 reopens Madrid, the transfer is still Ana
pays Chloé `16,01 €`.

Also used: group 1 "Lisbon & Porto" (`1.915,57 €`; Ana pays Ben `63,75 €`, David pays Ben `27,65 €`, David pays Chloé
`27,07 €`), group 2 "Empty weekend" (Eva, `0,00 €`, no expenses), and group 5 with Noah's "Private jet charter"
`1.000.000,00 €` (total shown as `2,34 M €`).

These figures were calculated with the current API code (the `v_*` views behind `SummaryService` and `ExpenseService`)
on a fresh in-memory database after the existing seed, with the edited input rows written as the edit will write them.

## Tests

- **PHP (`packages/api/tests`, run through `tests/functional`):**
  - edit: `PUT` recalculates shares, balances and transfers (figures from the seed section). `recorded_by` and
    `created_at` stay. One `expense_changes` row holds the editor's user id, a time, and before/after snapshots of the
    full input. A save without changes writes nothing and keeps `edited: false`. `422` field errors match the create
    ones. `edited` shows in the list, create and edit responses.
  - access: `401` without a token; `404` for an unknown group; `403` for a non-member (e.g. Ben on group 7); `404` for
    an expense of another group (`PUT /trips/1/expenses/{a trip 7 expense}`); `404` for an unknown expense id.
  - paid: `POST …/paid` stores a `paid` row with the user and time. The summary has `paid.by` (the marker's shown name
    on the group) and `paid.at` in `YYYY-MM-DDTHH:MM:SSZ`, and keeps the real balances and transfers. `GET /trips`
    reports `paid`. A paid group answers `409 trip_paid` to `POST …/expenses`, `?dry_run=1` and `PUT`. Marking twice
    gives `409 already_paid`, and reopening an open group gives `409 already_open`. Reopen stores an `open` row, and
    afterwards writes work again. Both actions work for any member. `409` comes before `422`.
  - existing tests still pass unchanged, apart from the new fields.
- **TypeScript (`tests/unit`):** cents and basis points to input strings (`3150` → "31,50", `100000000` →
  "1000000,00", `5` → "0,05", `3333` → "33,33", `7000` → "70,00"), each round-tripping through the existing parsers.
  Prefilling the form state from an `Expense` DTO (one payer, several payers, each split type). `updateExpense`,
  `markPaid` and `reopenTrip` send the right method, path and body (fake `fetch`).
- **Playwright (`tests/e2e`, 390x844):** a new `edit-and-paid.test.ts` with one screenshot per 📸 check below, on a
  fresh seed, in the order of the checks.

## Acceptance checks

Viewport 390x844. Freshly seeded database. App at http://localhost:8081. Every demo password is `travel-demo-2026`.
Run the checks in order: checks 4–14 build on each other. "{today}" is the local date of the check, e.g. "28 Oct
2026".

1. 📸 **Open group view.** Log in as `ana@example.com` and open "Madrid weekend". The header shows "‹ My groups" and "Mark
   as paid". Both expense rows show "›" and are buttons at least 48 px high. Neither shows "Edited". The tab bar shows
   "+ Add expense".
2. 📸 **Edit form, prefilled.** Tap "Tapas at Mercado de San Miguel". "Edit expense" opens with name "Tapas at Mercado
   de San Miguel", date `2026-09-12`, amount `48,30`, "Paid by" Chloé selected, "Equally" selected, "Split between"
   Ana and Chloé selected, the split preview Ana `24,15 €` / Chloé `24,15 €`, and "Save changes" at the bottom. There is
   no tab bar.
3. **Save without changes.** Tap "Save changes" right away. The group view shows total `78,30 €`, "Ana pays Chloé
   `9,15 €`", and no "Edited" on any row.
4. 📸 **Edit the amount.** Open "Tapas at Mercado de San Miguel", change the amount to `50,01`, and tap "Save changes".
   The group view shows total `80,01 €`, "Ana pays Chloé `10,01 €`", and the row "Tapas at Mercado de San Miguel
   `50,01 €`" with "Recorded by Chloé" and "Edited". Balances shows Ana `-10,01 €` and Chloé `+10,01 €`.
5. **Edit the split type.** Open "Prado Museum tickets", choose "Percent", and enter Ana `70` and Chloé `30`. The preview
   shows Ana `21,00 €` and Chloé `9,00 €`. Save. The group view shows total `80,01 €` and "Ana pays Chloé `16,01 €`".
   Both rows show "Edited", and "Prado Museum tickets" still reads "Recorded by Ana". "‹ My groups": Madrid weekend shows
   `80,01 €`.
6. **Invalid edit.** Open "Prado Museum tickets", clear the name and set the amount to `0`, then tap "Save changes".
   "Enter a name for the expense." and "Enter an amount greater than 0." appear, as in the add form. Tap "Cancel": the
   row still reads "Prado Museum tickets `30,00 €`" and the total is `80,01 €`.
7. 📸 **Mark as paid, confirmation.** Tap "Mark as paid". The screen shows "Mark this group as paid?", "These payments
   will be treated as done:", "Ana pays Chloé `16,01 €`", "Nobody can add or change expenses until the group is
   reopened.", "Mark as paid" at the bottom and "Cancel". Tap "Cancel": the group view is unchanged. Tap "Mark as paid"
   again.
8. 📸 **Paid group view.** On the confirmation, tap "Mark as paid". The group view shows the card "✓ Paid", "Marked as paid
   by Ana on {today}.", and total `80,01 €`. It shows no "Who owes whom", the header shows "Reopen", and the tab bar has
   only "Group" and "Balances". Tapping "Tapas at Mercado de San Miguel" opens nothing, and "Edited" still shows on both
   rows.
9. 📸 **Balances of a paid group.** Tap "Balances". Ana shows Paid `30,00 €` and Share `46,01 €`, and Chloé shows Paid
   `50,01 €` and Share `34,00 €`. Both show "Settled" instead of a net amount. "Everyone is settled up." replaces the
   transfers, and no `16,01 €` appears.
10. **My groups shows paid.** Tap "‹ My groups". "Madrid weekend" is not in the list; "Lisbon & Porto" shows no chip.
    Tap "Paid groups (1) ▸": "Madrid weekend" shows "✓ Paid" and `80,01 €`.
11. **Another member sees it.** Log in as `chloe@example.com` and open "Madrid weekend": the same paid view, with "Marked
    as paid by Ana on {today}." and "Reopen".
12. **The API locks a paid group.** In the console with Chloé's token, `POST /trips/7/expenses` (any valid body), the
    same with `?dry_run=1`, and `PUT /trips/7/expenses/{Tapas id}` each answer `409` with code `trip_paid`. `POST
    /trips/7/paid` answers `409 already_paid`.
13. 📸 **Paid while editing.** Log in as Ben in one browser tab, open "Lisbon & Porto" and open "Taxi to Porto airport".
    In a second tab, log in as Ana, open "Lisbon & Porto", and mark it as paid. In Ben's tab, change the amount to
    `32,00` and tap "Save changes". The card "This group is marked as paid. Reopen it to make changes." shows above the
    button, and the amount field still reads `32,00`. Tap "Cancel": the paid view of "Lisbon & Porto" with "Marked as
    paid by Ana on {today}.", and the row still reads `31,50 €`.
14. **Reopen.** As Chloé on the paid "Madrid weekend", tap "Reopen". "Who owes whom" shows "Ana pays Chloé `16,01 €`"
    again, "+ Add expense" is back, the rows show "›" and "Edited", and the header shows "Mark as paid". In the console,
    `POST /trips/7/reopen` answers `409 already_open`. "‹ My groups": no chip on "Madrid weekend".
15. **Paid with nothing to settle.** Log in as `eva@example.com` and open "Empty weekend". Tap "Mark as paid": the
    confirmation shows "Everyone is settled up." instead of a list. Confirm: the "✓ Paid" card, total `0,00 €`, and
    "Marked as paid by Eva on {today}.".
16. **Very large amount.** Log in as `noah@example.com`, open the long-name group and open "Private jet charter". The
    amount field shows `1000000,00`. Tap "Save changes": the row reads `1.000.000,00 €` with no "Edited", and the total
    stays `2,34 M €`.
17. 📸 **API unreachable.** With the API blocked: on Ana's "Edit expense" for "Prado Museum tickets" (Madrid, open
    again after check 14), "Save changes" shows the form's error card and the input stays. "Mark as paid" on the
    confirmation shows "Could not reach the API at http://localhost:8080." above the button, and the group stays open.
    On a paid group (Lisbon after check 13), "Reopen" shows the same message at the top of the Group tab, and the group
    stays paid. With the API back, each action works.
18. **API errors.** In the console with Ana's token: `PUT /trips/1/expenses/{Tapas id}` (an expense of group 7) answers
    `404 not_found`. With Ben's token, `PUT /trips/7/expenses/{Tapas id}` answers `403 not_a_member`. `PUT`, `POST
    …/paid` and `POST …/reopen` without a token answer `401`. The change records of checks 4 and 5 hold Ana's user id,
    a time and before/after snapshots (checked by the PHP tests).
19. **Earlier epics still hold.** With a fresh seed, the epic 1, 2 and 3 checks show the same figures as before.

## Out of scope

From the roadmap: showing the change history in the app, deleting expenses, recording individual settle-up payments,
partial settlement, and notifications. Excluded in the rounds: changing "Recorded by" on an edit (it stays the first
recorder), editing a paid group without reopening it, a confirmation before "Reopen", only the marker being able to
reopen, `PATCH` or a status endpoint instead of `PUT` and the two `POST` actions, amounts with thousands separators in
input fields, and new seed data (paid groups or change records).

## Check on iOS and Android

- An expense row responds to a tap across the whole card and gives pressed feedback. Scrolling the list does not open
  a row by accident.
- The edit form opens with the right keyboard per field (`decimal-pad` for amounts) and the prefilled values stay
  editable. The cursor can be placed inside "1000000,00".
- "Mark as paid" and "Reopen" in the header fit next to "‹ My groups" with the largest accessibility text size, and
  respond across 48 px.
- The "✓" in "✓ Paid" renders in the platform font on both platforms.
- "{today}" in "Marked as paid by … on …" is the device's local date, also for a mark made just before midnight UTC.
- Both platforms still build: Expo export for `ios` and `android` succeeds in the container.
