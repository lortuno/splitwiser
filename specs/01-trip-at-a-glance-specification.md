# Epic 1: Trip at a glance — specification

Source: `specs/roadmap.md` (epic 1) and the decisions in `specs/01-trip-at-a-glance-brainstorming.md`.
Boundaries: `specs/guidelines/architecture.md` and `specs/guidelines/ui.md` apply unchanged.

## Goal

When someone opens the app, the first screen shows at a glance how much the group has spent and who has to pay whom.
They no longer need to switch to the Balances tab for that. The work reshapes an existing screen: there is no new
endpoint and no new calculation, and all money still comes from the API as integer cents.

## Screens

### App shell (`App.tsx`)

- **Which trip is opened:** on the web, `?trip={id}` in the URL opens that trip. Without the parameter, and always on
  iOS and Android, the first trip from `GET /trips` opens. That is "Lisbon & Porto" after a fresh seed.
- **Loading state:** unchanged. A centred spinner with "Loading…".
- **Error state (API unreachable):** unchanged. A centred "Could not reach the API at {url}." with a "Try again" button
  (at least 48 px high) that repeats the load.
- **Not-found state (new):** shown when the trip id is not a positive whole number (no request is sent) or the API
  answers 404. A centred "This trip does not exist." with an "Open the demo trip" button (at least 48 px high). The button
  removes `?trip=` from the URL and loads the first trip.
- **Header:** trip name, one line, cut off with "…" when too long. Unchanged.
- **Tab bar:** **Trip** (renamed from "Expenses") | **Balances** | **+ Add expense**. The add button stays 56 px high at
  the bottom of the screen, in thumb reach.

### Trip view (hero, `TripScreen`)

Layout at 390 px, top to bottom, as agreed in the brainstorming (Q2):

```
┌──────────────────────────────────────┐
│ Lisbon & Porto                       │  header (title 20, 1 line, …)
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ Total trip spend                 │ │  body, inkMuted
│ │ 1.915,57 €                       │ │  hero 44, bold
│ │ 1 Jun 2026 – 7 Jun 2026 · 20 exp…│ │  caption, inkMuted
│ │ 4 people                         │ │  caption, inkMuted
│ └──────────────────────────────────┘ │
│ Who owes whom                        │  title 20
│ ┌──────────────────────────────────┐ │
│ │ Ana pays Ben              63,75 € │ │  Card per transfer, max 3
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ David pays Ben            27,65 € │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ David pays Chloé          27,07 € │ │
│ └──────────────────────────────────┘ │
│ [Show all 4]                         │  only with > 3 transfers
│ Expenses                             │  title 20
│ ┌──────────────────────────────────┐ │
│ │ Taxi to Porto airport     31,50 € │ │  existing ExpenseRow,
│ │ 7 Jun 2026 · Paid by David       │ │  newest first
│ │ Recorded by Chloé · Split betw. 4│ │
│ └──────────────────────────────────┘ │
│   …                                  │
├──────────────────────────────────────┤
│ [  Trip  ] [Balances] [+ Add expense]│
└──────────────────────────────────────┘
```

The whole screen is one vertical scrolling list (`FlatList` with a header). It never scrolls sideways.

**Total card**
- "Total trip spend", then the total, then "{start} – {end} · {n} expenses", then "{n} people".
- Total format: below `1.000.000,00 €` it is shown in full with `formatCents` (`1.915,57 €`, `999.999,99 €`). From
  `1.000.000,00 €` up it is shown in millions with `formatCentsCompact`: two decimals, cut off rather than rounded, and a
  trailing `,00` dropped (`100000000` → `1 M €`, `234567891` → `2,34 M €`, `2000000000` → `20 M €`). The short form is
  used only for the hero total; every other amount is shown in full.
- Counts: "1 expense" / "{n} expenses" and "1 person" / "{n} people".

**Who owes whom**
- Not shown at all when the trip has no expenses (`expense_count = 0`).
- When there are expenses but `transfers` is empty: one line, "Everyone is settled up."
- Otherwise the first 3 transfers in the order the API returns them, one `Card` each: "{from} pays {to}" on the left
  (wraps when long) and the amount on the right, in full, on one line. These rows are plain text and do nothing when
  tapped.
- With more than 3 transfers: a "Show all {count}" text button below the cards, left-aligned, `accent` colour, at least
  `size.tapMin` (48) high. It switches to the Balances tab.

**Expenses**
- The heading "Expenses", then the existing expense rows, unchanged: the name is cut off after 2 lines, and the amount
  never wraps.
- Empty: "No expenses yet. Tap + Add expense to record the first one."

### Balances tab (`BalancesScreen`)

Unchanged. It keeps every per-person balance and the full "Who owes whom" list. "Show all" leads here.

### Add expense (`AddExpenseScreen`)

Unchanged, including `decimal-pad` / `inputMode="decimal"` for amounts. After saving, the trip view shows the new
expense and updates the total and transfers from the summary the save returns (no second request), as it does today.

## Data

**Reads:** trip (name, dates, members), expenses (newest first), summary (`total_cents`, `expense_count`, `transfers`).
The app only formats these values. It never adds, subtracts or divides amounts (architecture rule 6).
**Writes:** none new. Only the existing `POST /trips/{id}/expenses` from the add form.
**Schema:** no change.

## API

No new endpoint and no change to any response. These are the endpoints the screen depends on; all money is integer
cents.

| Request | Response |
|---|---|
| `GET /trips` | `200 [{ id, name, start_date, end_date, total_cents }]`, first trip = default |
| `GET /trips/{id}` | `200 { id, name, start_date, end_date, total_cents, members: [{ id, name }] }`; unknown or non-numeric id → `404 { error: { code: "not_found", message } }` |
| `GET /trips/{id}/expenses` | `200 [{ id, trip_id, name, date, amount_cents, split_type, recorded_by: { id, name }, paid_by: [{ person_id, name, amount_cents }], split_between: [{ person_id, name, split_value, share_cents }] }]`, date desc, id desc |
| `GET /trips/{id}/summary` | `200 { trip_id, currency: "EUR", total_cents, expense_count, balances: [{ person_id, name, paid_cents, share_cents, net_cents }], transfers: [{ from: { id, name }, to: { id, name }, amount_cents }] }`; unknown id → `404` |
| `POST /trips/{id}/expenses` | Unchanged: `201 { expense, summary }`, `422` with field errors |

The functional tests pin this contract for the seeded trips, so the hero cannot drift from it unnoticed.

## Seed data

The existing demo trip stays exactly as it is and is still created first. Five fixed test trips are added after it,
through `ExpenseService` like the demo expenses, with no random values or dates (architecture rule 9). After a fresh
database (`docker compose down -v && docker compose up`) the ids are:

| id | Trip | Dates | People | Expenses | Expected on the hero |
|---|---|---|---|---|---|
| 1 | Lisbon & Porto | 2026-06-01 – 06-07 | Ana, Ben, Chloé, David | the existing 20 | Total `1.915,57 €`; Ana pays Ben `63,75 €`, David pays Ben `27,65 €`, David pays Chloé `27,07 €` |
| 2 | Empty weekend | 2026-07-10 – 07-12 | Eva, Finn, Greta | none | `0,00 €`, "0 expenses", no transfers section |
| 3 | Even split | 2026-08-01 – 08-02 | Hugo, Iris | Lunch `40,00 €` paid by Hugo; Dinner `40,00 €` paid by Iris; both split equally between both | `80,00 €`, "Everyone is settled up." |
| 4 | Three-way taxi | 2026-09-05 – 09-05 | Jon, Kim, Lea | Taxi `10,00 €` paid by Jon, split equally between all three (shares `3,34` / `3,33` / `3,33 €`) | `10,00 €`, "1 expense"; Kim pays Jon `3,33 €`, Lea pays Jon `3,33 €` |
| 5 | Grand tour of every UNESCO world heritage site in southern Europe by sleeper train | 2026-10-01 – 10-31 | Maximiliane Alexandra von Hohenzollern-Sigmaringen, Noah | Private jet charter `1.000.000,00 €`; Yacht week `1.000.000,00 €`; "Overnight sleeper train from Lisbon to Madrid with a private compartment, breakfast, late checkout, and luggage storage." (exactly 120 characters) `345.678,91 €`; all paid by Noah, split equally between both | `2,34 M €` (exact total `2.345.678,91 €`); Maximiliane … pays Noah `1.172.839,46 €` |
| 6 | Big group | 2026-11-01 – 11-03 | Olga, Paul, Quinn, Rosa, Sam, Tara | Group dinner `60,00 €` paid by Olga, split equally between all six; Boat tickets `30,00 €` paid by Paul, split equally between Paul, Quinn, Rosa | `90,00 €`; Quinn pays Olga `20,00 €`, Rosa pays Olga `20,00 €`, Sam pays Olga `10,00 €`, "Show all 4"; Balances also lists Tara pays Paul `10,00 €` |

The figures above were calculated with the current API on an in-memory database. The seed test keeps checking that
the demo trip has 4 people and 20 expenses; a new test pins the five test trips.

## Tests

- **PHP (`packages/api/tests`, run through `tests/functional`):** summaries for trips 1–6 return exactly the totals,
  counts and transfers in the seed table; a fresh seed creates the same ids every time; `GET /trips/999`,
  `/trips/abc` and `/trips/999/summary` return 404 with `code: "not_found"`.
- **TypeScript (`tests/unit`):** `formatCentsCompact` for `99999999` → `999.999,99 €`, `100000000` → `1 M €`,
  `100999999` → `1 M €` (cut off, not rounded), `123456789` → `1,23 M €`, `234567891` → `2,34 M €`, `2000000000` →
  `20 M €`; reading `?trip=` (`"4"` → 4; `"0"`, `"-1"`, `"abc"`, `"1.5"` → invalid; missing → default); singular and
  plural count strings.
- **Playwright (`tests/e2e`, 390x844):** one screenshot per check marked 📸 below, on a fresh seed.

## Acceptance checks

Viewport 390x844, freshly seeded database (`docker compose down -v && docker compose up`), app at
http://localhost:8081. Run check 15 last, because it adds an expense.

1. 📸 **Trip view, demo trip.** Open `/`. The header shows "Lisbon & Porto". The total card shows "Total trip spend",
   `1.915,57 €` in large bold type, "1 Jun 2026 – 7 Jun 2026 · 20 expenses" and "4 people". Below it "Who owes whom" lists
   exactly: "Ana pays Ben `63,75 €`", "David pays Ben `27,65 €`", "David pays Chloé `27,07 €`". There is no "Show all".
   The total and all three transfers are visible without scrolling.
2. **Trip view, demo trip, expenses.** Scroll down. "Expenses" lists 20 rows, newest first, starting with "Taxi to
   Porto airport `31,50 €`" (7 Jun 2026, paid by David). The page never scrolls sideways.
3. **Tab bar.** The tabs read "Trip", "Balances" and "+ Add expense". "Trip" is selected. "+ Add expense" is the
   tallest button and sits at the bottom edge.
4. **Transfer rows are not buttons.** On the demo trip, tap "Ana pays Ben". Nothing happens and the screen stays on
   Trip.
5. **Balances unchanged.** Tap "Balances". It shows Ana `-63,75 €`, Ben `+91,40 €`, Chloé `+27,07 €`, David `-54,72 €`
   and the same three transfers as check 1.
6. 📸 **Empty trip.** Open `/?trip=2`. The header shows "Empty weekend". The total shows `0,00 €`, "10 Jul 2026 – 12 Jul
   2026 · 0 expenses", "3 people". There is no "Who owes whom" heading. Under "Expenses": "No expenses yet. Tap + Add
   expense to record the first one."
7. 📸 **Everyone even.** Open `/?trip=3`. The total shows `80,00 €`, "2 expenses". "Who owes whom" shows only "Everyone is
   settled up." Both expenses are listed with `40,00 €`.
8. **Uneven cents.** Open `/?trip=4`. The total shows `10,00 €` and "1 expense" (singular). "Who owes whom" shows "Kim
   pays Jon `3,33 €`" and "Lea pays Jon `3,33 €`". On Balances, Jon shows `+6,66 €`, Kim `-3,33 €`, Lea `-3,33 €` (`formatSignedCents` prints a plain hyphen-minus).
9. 📸 **Very large amount and long names.** Open `/?trip=5`. The header shows the trip name on one line, ending in "…".
   The total shows `2,34 M €` on one line, "1 Oct 2026 – 31 Oct 2026 · 3 expenses", "2 people". The transfer row reads
   "Maximiliane Alexandra von Hohenzollern-Sigmaringen pays Noah": the names wrap and `1.172.839,46 €` stays on one line,
   right-aligned. The 120-character expense name is cut off after two lines with "…", with `345.678,91 €` beside it. The
   two other expenses show `1.000.000,00 €` in full.
10. 📸 **More than three transfers.** Open `/?trip=6`. The total shows `90,00 €`. "Who owes whom" shows exactly "Quinn pays
    Olga `20,00 €`", "Rosa pays Olga `20,00 €`" and "Sam pays Olga `10,00 €`", followed by "Show all 4".
11. **Show all.** On `/?trip=6`, tap "Show all 4". The Balances tab opens and lists all four transfers, including "Tara
    pays Paul `10,00 €`".
12. 📸 **Unknown trip.** Open `/?trip=999`. The screen shows "This trip does not exist." and an "Open the demo trip"
    button. Tap it: the URL no longer has `?trip=` and the demo trip from check 1 is shown.
13. **Invalid trip id.** Open `/?trip=abc`, then `/?trip=0`. Both show "This trip does not exist." The browser's network
    tab shows no request to `/trips/abc` or `/trips/0`.
14. 📸 **API unreachable.** Run `docker compose stop api`, then reload `/`. The screen shows "Could not reach the API at
    http://localhost:8080." and "Try again". Run `docker compose start api` and tap "Try again": the demo trip from
    check 1 is shown.
15. **The hero updates after adding.** Open `/?trip=4` and tap "+ Add expense". Enter "Coffee", amount `3,00`, paid by Kim,
    split equally between Jon, Kim and Lea, and save. Back on Trip, the total shows `13,00 €`, "2 expenses", and "Who owes
    whom" shows "Lea pays Jon `4,33 €`" and "Kim pays Jon `1,33 €`". The page was not reloaded.

The Playwright suite runs checks 1, 6, 7, 9, 10, 12 and 14. Checks 12 and 14 use a stopped or mocked API inside the
test, not a stopped Docker service.

## Out of scope (from the roadmap)

Login, the trip list, creating trips, editing expenses, marking a trip as paid (and how a paid trip looks), changes to
per-person balances, any new calculation or endpoint, pull-to-refresh, and changes to the add-expense form.

## Check on iOS and Android (not visible in the browser)

- `?trip=` does not exist on native apps: they always open the first trip. Check that the app starts on "Lisbon & Porto".
- Status bar: on a notched iPhone and on Android the header must not sit under the status bar (`statusBarInsetIos`,
  `StatusBar.currentHeight`).
- The `2,34 M €` total and the `1.172.839,46 €` transfer amount stay on one line with the system font and with the
  largest accessibility text size.
- "Show all" and "Try again" respond to a thumb tap across their full height, and the tab bar is not hidden by the
  Android navigation bar or the iOS home indicator.
- Both platforms still build: Expo export for `ios` and `android` succeeds in the container.
