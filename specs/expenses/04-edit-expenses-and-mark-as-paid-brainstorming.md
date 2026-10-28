# Epic 4: Edit expenses and mark a trip as paid — brainstorming

Source: `specs/roadmap.md`, epic 4. Boundaries: `specs/guidelines/architecture.md`, `specs/guidelines/ui.md`.
Append-only: questions and answers are never changed once written. Answer by moving the `[x]` or adding a note under
the question.

## What exists today (for reference)

- **Expenses are write-once.** `expenses` (name, `spent_on`, `amount_cents`, `recorded_by` person, `split_type`,
  `created_at`) with `expense_payers` and `expense_splits` as input rows; shares, balances and totals come from the
  `v_*` views. There is no update endpoint and no change history. `POST /trips/{id}/expenses` (and `?dry_run=1` for the
  split preview) returns `{ expense, summary }`. The recorder is always the logged-in person (epic 2).
- **Add expense form** (`AddExpenseScreen`): name, date, amount (`decimal-pad`), "Paid by" chips (several payers with
  their own amounts), "Split between" chips, split type (Equally / Amounts / Percent / Shares) with per-person values
  and a live split preview from `?dry_run=1`. It always starts empty. "Save expense" sits at the bottom.
- **Trip view** (`TripScreen`): total card, "Who owes whom" (hidden when the trip has no expenses), then expense rows
  ("{name} {amount}", "{date} · Paid by …", "Recorded by … · Split between n"). Rows do nothing when tapped. Tabs: Trip,
  Balances, "+ Add expense".
- **No trip status.** `trips` has only name and dates. "My trips" cards show name, dates and total.
- **People and names (epic 3):** a person shows the account's `display_name` when linked, otherwise the typed name.
  Users are identified by `users.id`; sessions give the API the logged-in user and their person on the trip.
- **Seed:** trips 1–8 (Lisbon & Porto, the epic 1 fixtures, Madrid weekend, Ski week) and 10 demo accounts
  (`travel-demo-2026`). Every epic 1–3 check relies on their current figures.

---

## Round 1

Functionality and the rules behind it.

### Q1. Who can edit an expense, and what happens to "Recorded by"?
- [x] Any member of the trip can edit any expense. "Recorded by" keeps the person who first recorded it; the editor is stored only in the change record. (Recommended: matches the roadmap, "only members can edit".)
- [ ] Only the person who recorded the expense can edit it.
- [ ] Any member can edit, and "Recorded by" becomes the last editor.

### Q2. What does a change record store?
The roadmap: the database keeps who, when and what changed; the app shows only an "edited" label.
- [x] One row per save in a new table `expense_changes`: expense id, `changed_by` (the user id from the session), `changed_at`, and `before` / `after` as JSON snapshots of the full input (name, date, amount, payers with amounts, split type, split values). Append-only, never shown in the app. (Recommended: one simple shape for every kind of change.)
- [ ] One row per changed field (field name, old value, new value).
- [ ] Keep every version of the expense rows themselves (copies of `expenses`, `expense_payers`, `expense_splits`).

### Q3. Saving without any real change
- [x] If the saved input is identical to the current one, nothing is written: no change record and no "edited" label. The response is still `200`. (Recommended)
- [ ] Every save writes a change record and sets the label, even without differences.

### Q4. Where is "edited" worked out?
- [x] In the API: every expense in `GET /trips/{id}/expenses` and in write responses gets `edited: true|false` (true when at least one change record exists). Nothing else about the history is exposed. (Recommended)
- [ ] Store an `edited_at` column on `expenses` and expose that date.

### Q5. Can a trip be marked as paid while transfers are still open?
People settle up outside the app (recording individual payments is out of scope).
- [x] Yes, at any time by any member. Before confirming, the app lists the open transfers ("These payments will be treated as done"). Afterwards the trip counts as settled. (Recommended: the app cannot know about payments made outside it.)
- [ ] Only when "Who owes whom" is already empty.

### Q6. What does the API report for a paid trip?
All maths stays in the API.
- [x] `GET /trips/{id}/summary` keeps the total and each person's paid and share amounts, but returns every `net_cents` as `0`, `transfers: []`, and a new `paid: { by: {id, name}, at }` (null when open). Reopening brings the calculated nets and transfers back unchanged. (Recommended)
- [ ] Keep the real nets and transfers and only add the `paid` field; the app hides them.

### Q7. How are "paid" and "reopened" stored?
- [x] Append-only table `trip_status_changes` (trip id, `status` paid|open, `changed_by` user id, `changed_at`). The current status is the latest row; a trip without rows is open. Who and when of both actions stay in the database. (Recommended)
- [ ] Columns on `trips` (`paid_at`, `paid_by`), cleared on reopen; only the last action is kept.

### Q8. What does a paid trip lock?
- [x] New expenses, edits and the split preview (`?dry_run=1`) are rejected with `409 trip_paid` ("This trip is marked as paid. Reopen it to make changes."). Reading stays allowed. Marking an already paid trip as paid, or reopening an open one, answers `409` too (`already_paid` / `already_open`). (Recommended)
- [ ] As above, but repeated mark/reopen requests answer `200` and change nothing.

### Q9. Who can reopen a trip?
- [x] Any member, as the roadmap says. The person who marked it as paid is not special. (Recommended)
- [ ] Only the person who marked it as paid.

- [x] Round 1 answered (tick this when you have answered every question above)

## Round 2

**Round 1 answers, given in the chat (2026-10-28).** They replace the `[x]` marks above where they differ:
Q1 any member edits, "Recorded by" stays the first recorder · Q2 one `expense_changes` row per save with before/after
snapshots · Q3 a save without changes writes nothing · Q4 the API sends `edited: true|false` · Q5 any member can mark
as paid at any time, the app lists the open transfers first · **Q6 "Real nets + flag": the summary of a paid trip
keeps the real `net_cents` and `transfers` and only adds `paid: { by, at }`; the app hides them** (not the
recommendation) · Q7 append-only `trip_status_changes` · Q8 `409 trip_paid` on writes, `409 already_paid` /
`already_open` on repeats · Q9 any member can reopen.

Screens. Correct any wireframe directly below it, or tick another option. All buttons are at least `size.tapMin`
(48 px) high, and primary buttons are `size.tapPrimary` (56 px) high and sit at the bottom. There are no browser
dialogs: confirmations are in-app cards.

### Q1. Trip view, open trip (changed)

```
┌──────────────────────────────────────┐
│ ‹ My trips             Mark as paid  │  two text buttons, 48 high, accent
│ Lisbon & Porto                       │  trip name, title 20, 1 line, "…"
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ Total trip spend                 │ │  total card unchanged
│ │ 1.915,57 €                       │ │
│ │ 1 Jun 2026 – 7 Jun 2026 · 20 exp…│ │
│ └──────────────────────────────────┘ │
│ Who owes whom                        │  unchanged
│ …                                    │
│ Expenses                             │
│ ┌──────────────────────────────────┐ │  each row is now a button
│ │ Taxi to Porto airport   31,50 € ›│ │  (whole card, ≥ 48 high);
│ │ 7 Jun 2026 · Paid by David       │ │  "›" hints it opens
│ │ Recorded by Chloé · Split betw… │ │
│ │ Edited                           │ │  caption, inkMuted, only when
│ └──────────────────────────────────┘ │  edited: true
├──────────────────────────────────────┤
│ [  Trip  ] [Balances] [+ Add expense]│  tab bar unchanged
└──────────────────────────────────────┘
```
- [x] As drawn: "Mark as paid" top right in the header, "Edited" as its own caption line on the row. (Recommended)
- [ ] As drawn, but "Mark as paid" is a full-width button at the end of the Trip tab, under the expense list.
- [ ] As drawn, but "Edited" sits after the date: "7 Jun 2026 · Paid by David · Edited".

### Q2. "Mark as paid" confirmation (new, in-app card over the trip view)

```
┌──────────────────────────────────────┐
│ ‹ My trips                           │
│ Lisbon & Porto                       │
├──────────────────────────────────────┤
│ Mark this trip as paid?              │  title 20 bold
│                                      │
│ These payments will be treated as    │  body
│ done:                                │
│ ┌──────────────────────────────────┐ │
│ │ Ana pays Ben             63,75 € │ │  the open transfers, as on the
│ │ David pays Ben           27,65 € │ │  trip view (all of them, not
│ │ David pays Chloé         27,07 € │ │  only the first 3)
│ └──────────────────────────────────┘ │
│ Nobody can add or change expenses    │  caption, inkMuted
│ until the trip is reopened.          │
│                                      │
│            (flexible space)          │
│ ┌──────────────────────────────────┐ │
│ │           Mark as paid           │ │  primary, 56 high, bottom
│ └──────────────────────────────────┘ │
│              Cancel                  │  text button, 48 high
└──────────────────────────────────────┘
```
With no open transfers the list is replaced by "Everyone is settled up." The tab bar is hidden while this shows.
- [x] As drawn, as its own full screen inside the trip view. (Recommended)
- [ ] No confirmation: "Mark as paid" acts at once (it can be undone with "Reopen").

### Q3. Trip view, paid trip (changed)

```
┌──────────────────────────────────────┐
│ ‹ My trips                   Reopen  │  "Reopen" replaces "Mark as paid"
│ Lisbon & Porto                       │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ ✓ Paid                           │ │  accentSoft card, title bold
│ │ Marked as paid by Ana on         │ │  body
│ │ 28 Oct 2026.                     │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Total trip spend                 │ │  total card unchanged
│ │ 1.915,57 €                       │ │
│ └──────────────────────────────────┘ │
│                                      │  no "Who owes whom" section
│ Expenses                             │
│ ┌──────────────────────────────────┐ │  rows are NOT buttons
│ │ Taxi to Porto airport    31,50 € │ │  (no "›"); "Edited" still
│ │ …                                │ │  shows where it applies
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ [    Trip    ] [    Balances    ]    │  no "+ Add expense"
└──────────────────────────────────────┘
```
"Reopen" acts at once (no confirmation) and brings back "Who owes whom", tappable rows and "+ Add expense".
- [x] As drawn. (Recommended)
- [ ] As drawn, but "Reopen" also asks for confirmation.

### Q4. Balances tab of a paid trip (follow-up to your Q6 answer)
The API keeps the real nets and transfers for a paid trip; the app decides what to hide.
- [x] Show "Paid" and "Share" per person as now, replace each "Net" amount with the word "Settled", and show "Everyone is settled up." instead of the transfers. The real nets are not shown. (Recommended: reads as settled, as the roadmap asks.)
- [ ] Show the real nets greyed out (`inkMuted`) with a note "Settled outside the app", and no transfers.
- [ ] Hide the whole per-person table; show only "Everyone is settled up."

### Q5. Edit expense form (changed `AddExpenseScreen`)

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
After saving, the trip view shows the updated row with "Edited" and the updated total and transfers. "Cancel"
returns to the trip view without saving. The tab bar is hidden, as for "+ Add expense".
- [x] As drawn: the same form, prefilled, with "Edit expense" and "Save changes". (Recommended)
- [ ] As drawn, plus a read-only line "Recorded by Chloé" at the top.

### Q6. "My trips" card of a paid trip (changed)

```
│ ┌──────────────────────────────────┐ │
│ │ Lisbon & Porto            ✓ Paid │ │  "✓ Paid" chip, accentSoft,
│ │ 1 Jun 2026 – 7 Jun 2026          │ │  right of the name
│ │ Total                 1.915,57 € │ │
│ └──────────────────────────────────┘ │
```
`GET /trips` gets `paid: true|false` per trip. Order stays newest start date first.
- [x] As drawn. (Recommended)
- [ ] As drawn, and paid trips move to the bottom of the list.

- [x] Round 2 answered (tick this when you have answered every question above)

## Round 3

Round 2 answers, given in the chat (2026-10-28), all as recommended: "Mark as paid" in the header and "Edited" on its
own line; a confirmation screen listing the open transfers; "Reopen" acts at once; on a paid trip's Balances, "Settled"
replaces each Net amount and "Everyone is settled up." replaces the transfers; the edit form is the add form,
prefilled, with "Edit expense" / "Save changes"; a "✓ Paid" chip on "My trips".

API, errors, edge cases and seed data. Exact euro amounts in the spec will come from running the real API code on a
fresh database.

### Q1. Endpoints
```
PUT  /trips/{id}/expenses/{expenseId}   body as POST /trips/{id}/expenses
                                         → 200 { expense, summary }   (recorded_by never changes)
POST /trips/{id}/paid                    → 200 { summary }
POST /trips/{id}/reopen                  → 200 { summary }
GET  /trips/{id}/summary                 + paid: { by: { id, name }, at } | null
GET  /trips                              + paid: true|false per trip
GET  /trips/{id}/expenses, write responses   + edited: true|false per expense
```
The split preview while editing reuses `POST /trips/{id}/expenses?dry_run=1`. `paid.by` is the marker's person on that
trip (shown name, so a later rename shows); `paid.at` is a UTC timestamp `2026-10-28T09:15:00Z`, shown by the app as
the local date ("28 Oct 2026"). CORS adds `PUT`.
- [x] As listed. (Recommended)
- [ ] `PATCH` instead of `PUT` for the edit, and one `PUT /trips/{id}/status { status: "paid" | "open" }` instead of two endpoints.

### Q2. Errors, in this order
- [x] `401 unauthenticated` → `404 not_found` (unknown trip) → `403 not_a_member` → `404 not_found` (expense id not on this trip) → `409 trip_paid` (edit, add, preview on a paid trip) / `409 already_paid` / `409 already_open` → `422` field errors exactly as for a new expense. (Recommended)
- [ ] As above, but validation (`422`) before the paid check (`409`).

### Q3. How the app reacts to `409 trip_paid`
Another member may mark the trip as paid while you are editing or adding.
- [x] The form keeps its input and shows the owesSoft card "This trip is marked as paid. Reopen it to make changes." above the button; "Cancel" goes back to the trip view, which reloads and shows the paid state. (Recommended)
- [ ] Leave the form at once and show the paid trip view.

### Q4. Prefilled values in the edit form
- [x] Amounts as plain input without thousands separators ("31,50", "1000000,00"), percentages as "33,33", shares as whole numbers, exact amounts as "15,00", so they parse exactly as typed ones. A new app helper formats cents for an input field (unit tested). (Recommended)
- [ ] Amounts with thousands separators ("1.000.000,00"); the parser learns to accept them.

### Q5. Seed data
The epic 3 checks expect the first trip created after the seed to be trip 9, and every earlier check relies on the
current figures, so new seed rows would ripple through three specs.
- [x] No seed changes. The checks edit and mark as paid on the seeded trips through the app: "Madrid weekend" (trip 7, Ana and Chloé, `78,30 €`) for edits and paid/reopen, "Empty weekend" (trip 2, Eva) for marking a trip with no expenses as paid. Each e2e file starts on a fresh seed. (Recommended)
- [ ] Add seeded change records and a seeded paid trip (a new trip 9), and update the epic 3 spec and tests for the new ids.

### Q6. Edge cases as acceptance checks. Untick any you do not want.
- [x] Edit "Tapas at Mercado de San Miguel" on Madrid weekend from `48,30 €` to `50,01 €`: total, transfer and the leftover cent come from the API; the row shows "Edited"; "Recorded by Chloé" stays.
- [x] Edit the split type of "Prado Museum tickets" to Percent (Ana 70 %, Chloé 30 %): figures from the API.
- [x] Open an expense and tap "Save changes" without changing anything: no "Edited" label.
- [x] Invalid edit (empty name, amount `0`): the same messages as the add form; nothing changes.
- [x] Mark Madrid weekend as paid with an open transfer: confirmation lists "Ana pays Chloé `9,15 €`"; afterwards the "✓ Paid" card, no "Who owes whom", no "+ Add expense", rows not tappable; Balances shows "Settled"; "My trips" shows "✓ Paid".
- [x] As Chloé, open the paid Madrid weekend: same paid view, "Marked as paid by Ana on {date}".
- [x] Reopen: transfers and "+ Add expense" come back with the same amounts as before.
- [x] A form open while someone else marks the trip as paid: saving shows the `trip_paid` card (Q3).
- [x] Mark "Empty weekend" (no expenses) as paid: the confirmation says "Everyone is settled up.".
- [x] Very large amount: open Noah's "Private jet charter" (`1.000.000,00 €`); the amount field shows `1000000,00`, and saving without change keeps the row as it was.
- [x] API unreachable on "Save changes", "Mark as paid" and "Reopen": the card shows, nothing changes.
- [x] API: editing an expense of another trip by id → `404`; a non-member → `403`; marking twice → `409 already_paid`; reopening an open trip → `409 already_open`; the change record stores the editor's user id, the time and before/after.

- [x] Round 3 answered (tick this when you have answered every question above)

## Decisions made while writing the specification

- Round 3 answers: Q1–Q5 were answered in the chat (2026-10-28), all as recommended. Q6 got no answer in the chat, so
  the file's answer counts: every edge case stays.
- The checks edit Madrid weekend before marking it as paid, so the confirmation in check 7 lists "Ana pays Chloé
  `16,01 €`" (after both edits), not the `9,15 €` of the fresh seed named in Round 3 Q6.
- The conflict check (13) uses Lisbon & Porto with Ben editing and Ana marking as paid, so Madrid's paid/reopen flow
  stays linear. Lisbon then stays paid, and check 17 uses it for "Reopen" while the API is unreachable.
- New `409` messages: `already_paid` "This trip is already marked as paid." and `already_open` "This trip is already
  open.". On either, the app reloads the trip instead of showing an error.
- "Marking as paid…" is the busy label of the confirmation button. "Settled" replaces the Net amount in `inkMuted`.
- `paid.at` is UTC (`YYYY-MM-DDTHH:MM:SSZ`) and the app shows the device's local date.
- Figures (`80,01 €`; Ana pays Chloé `10,01 €`, then `16,01 €`; Tapas shares `25,01 / 25,00 €`; Prado `21,00 / 9,00 €`)
  come from the real views on an in-memory database with the edited input rows.
