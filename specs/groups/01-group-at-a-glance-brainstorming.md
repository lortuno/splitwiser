# Epic 1: Trip at a glance — brainstorming

Source: `specs/roadmap.md`, epic 1. Boundaries: `specs/guidelines/architecture.md`, `specs/guidelines/ui.md`.
Append-only: questions and answers are never changed once written. Answer by moving the `[x]` or adding a note under
the question.

## What exists today (for reference)

- `App.tsx` loads the **first** trip from `GET /trips`, then `GET /trips/{id}`, `GET /trips/{id}/expenses` and
  `GET /trips/{id}/summary` in parallel. Full-screen loading and error ("Could not reach the API at {url}." + "Try
  again") states already exist.
- Header bar with the trip name (one line). Tab bar at the bottom: **Expenses** | **Balances** | **+ Add expense**.
- `TripScreen` (Expenses tab): a card with "Total trip spend", the total in `hero` type, dates and expense count,
  then the expense list. "Who owes whom" transfers exist only on the Balances tab.
- `GET /trips/{id}/summary` already returns `total_cents`, `expense_count`, `balances[]` and `transfers[]`
  (`from`, `to`, `amount_cents`). Unknown trip → 404.
- Seed: one trip, "Lisbon & Porto", 4 people, 20 expenses. Expense name max 120 characters, amount max
  1.000.000,00 € (100 000 000 cents) per expense.
- There is no "paid" state for a trip yet; it arrives with epic 4.

---

## Round 1

### Q1. Which screen becomes the hero?
- [x] Reshape the existing `TripScreen` (first tab) into the hero; rename the tab from "Expenses" to "Trip". (Recommended: no new screen, no navigation change.)
- [ ] Keep `TripScreen` as is and add a new "Overview" tab in front of it.
- [ ] Replace both Expenses and Balances with one screen.

### Q2. Hero view layout at phone width (390 px). Correct this wireframe directly below if anything is wrong.

```
┌──────────────────────────────────────┐
│ Lisbon & Porto                       │  header bar (title, 1 line, ellipsis)
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │ Total trip spend                 │ │  caption, inkMuted
│ │ 2.096,47 €                       │ │  hero 44, bold
│ │ 1 Jun – 7 Jun 2026 · 20 expenses │ │  caption, inkMuted
│ │ 4 people                         │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Who owes whom                        │  title 20
│ ┌──────────────────────────────────┐ │
│ │ Chloé pays Ana           123,45 € │ │  one card per transfer
│ └──────────────────────────────────┘ │  (amounts illustrative)
│ ┌──────────────────────────────────┐ │
│ │ David pays Ben            67,89 € │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Expenses                             │  title 20
│ ┌──────────────────────────────────┐ │
│ │ Taxi to Porto airport     31,50 € │ │  existing expense rows,
│ │ 7 Jun 2026 · Paid by David       │ │  newest first, scroll
│ │ Recorded by Chloé · Split betw. 4│ │
│ └──────────────────────────────────┘ │
│   …                                  │
├──────────────────────────────────────┤
│ [  Trip  ] [Balances] [+ Add expense]│  tab bar, primary 56 high,
└──────────────────────────────────────┘  in thumb reach
```

- [x] This layout as drawn. (Recommended)
- [ ] Transfers above the total.
- [ ] Other (draw your correction below).

### Q3. How many transfers are shown?
- [x] All of them. Fewest-transfers settlement gives at most people − 1 rows (3 for the demo trip). (Recommended)
- [ ] The first 3, then "Show all" to the Balances tab.

### Q4. What does a transfer row do when tapped?
- [x] Nothing: it is not a `Pressable`, so it needs no tap target. (Recommended: settle-up actions arrive with epic 4.)
- [ ] Switch to the Balances tab.

### Q5. Should "Who owes whom" stay on the Balances tab too?
- [x] Yes, leave the Balances tab unchanged. The duplication is fine: Balances is the detail view. (Recommended)
- [ ] No, remove it there; Balances shows only per-person balances.

### Q6. Data loading: how does the hero get its data?
- [x] Unchanged: the existing three requests (`/trips/{id}`, `/expenses`, `/summary`). No new endpoint, no new maths. (Recommended)
- [ ] One new `GET /trips/{id}/overview` endpoint returning everything in one response.

### Q7. A trip with no expenses
- [x] Total card shows `0,00 €` and "0 expenses"; the "Who owes whom" section is hidden; the expense section shows "No expenses yet. Tap + Add expense to record the first one." (Recommended)
- [ ] Same, but keep the "Who owes whom" section with "Everyone is settled up."

### Q8. A trip with expenses where everyone is already even (no transfers)
- [x] "Who owes whom" section shows a single line: "Everyone is settled up." (existing string). (Recommended)
- [ ] Hide the section.

### Q9. Very large totals in hero type
The largest single expense is 1.000.000,00 €; a trip total can be larger (e.g. `20.000.000,00 €`, 15 characters),
which does not fit in one line at 44 px inside a 390 px card.
- [x] The total may wrap to a second line, never truncated; no font-size switching. (Recommended: simple, the same on every platform.)
- [ ] Step down from `hero` (44) to `display` (28) when the formatted amount is longer than 12 characters.
- [ ] Use `adjustsFontSizeToFit` (iOS/Android only, not on the web).

### Q10. Long names
Expense names (up to 120 characters), person names and the trip name.
- [x] Trip name: one line with ellipsis (as today). Expense name: up to 2 lines with ellipsis (as today). Transfer row: names wrap, the amount stays right-aligned and never wraps. (Recommended)
- [ ] Everything wraps in full, nothing is truncated.

### Q11. Edge-case trips for checking in the browser
The checks need a trip with no expenses, an even trip, an uneven-cents trip (e.g. 10,00 € split by 3 →
3,34 / 3,33 / 3,33 €), a very long expense name and a very large amount. Today the app can only show the first trip.
- [x] Add deterministic fixture trips to the seed after "Lisbon & Porto" (which stays first and the default), and let the web app open any trip with `?trip={id}` in the URL. (Recommended: every check is reproducible in a browser after `docker compose up`.)
- [ ] Fixture trips exist only in the PHP and Playwright test databases; the browser checks use the demo trip only.
- [ ] Add a simple trip switcher to the header (overlaps with epic 2's trip list).

### Q12. Unknown trip id (e.g. `?trip=999`)
- [x] Full-screen message "This trip does not exist." with a button "Open the demo trip". (Recommended)
- [ ] Silently fall back to the first trip.

### Q13. API unreachable
- [x] Keep the existing full-screen error with "Try again"; no change. On first load only, as today. (Recommended)
- [ ] Also add pull-to-refresh on the trip view (no pull gesture on the web).

### Q14. A trip already marked as paid
The "paid" state does not exist until epic 4.
- [x] Out of scope for epic 1: no column, no field, no check. Epic 4's spec adds the paid look to this hero. (Recommended)
- [ ] Add a read-only `paid` flag now so the hero can already show a "Paid" badge.

### Q15. Amount input / keyboard
The hero has no input. The add-expense form already uses `decimal-pad` / `inputMode="decimal"`.
- [x] Epic 1 does not touch the add-expense form; after saving, the hero updates from the returned summary (as today). (Recommended)
- [ ] Review the add-expense form in this epic as well.

### Round 1 answers

At the user's request the questions were asked one by one in the chat instead of being answered in this file. The
questions above are left as written; these are the answers given.

| Q | Answer |
|---|---|
| Q1 Hero screen | Reshape the existing `TripScreen`; the first tab is renamed from "Expenses" to "Trip". |
| Q2 Layout | The wireframe as drawn. |
| Q3 Transfers | **Changed from the recommendation:** show the first 3 transfers, then a "Show all" link that opens the Balances tab. |
| Q4 Row tap | Nothing: transfer rows are not tappable. Only "Show all" is. |
| Q5 Balances tab | Not asked separately: it follows from Q3. The Balances tab stays unchanged and keeps the full "Who owes whom" list. |
| Q6 Data | The existing three requests. No new endpoint, no new calculation. |
| Q7 No expenses | Total `0,00 €`, "0 expenses", no "Who owes whom" section, "No expenses yet. Tap + Add expense to record the first one." |
| Q8 Even trip | "Who owes whom" shows the single line "Everyone is settled up." |
| Q9 Large total | **Changed from the recommendation:** use a short form for large totals; the database and the API keep exact cents. After two follow-up questions: below `1.000.000,00 €` the total is shown in full; from `1.000.000,00 €` up it is shown in millions as `x,xx M €`, two decimals cut off (never rounded up), and a trailing `,00` dropped (`20 M €`, `2,34 M €`). There is no K form. This applies to the hero total only. The currency stays euros (`€`). |
| Q10 Long names | Keep today's truncation: trip name one line, expense name up to two lines, transfer names wrap, amounts never wrap. |
| Q11 Edge-case trips | Fixed test trips are added to the seed after "Lisbon & Porto", which stays first and the default; the web app opens any trip with `?trip={id}`. |
| Q12 Unknown trip | A full-screen "This trip does not exist." with an "Open the demo trip" button. |
| Q13 API unreachable | Keep today's full-screen error with "Try again". No pull-to-refresh. |
| Q14 Paid trip | Out of scope until epic 4. |
| Q15 Add form | Unchanged; the hero updates from the summary returned when an expense is saved. |

### Decisions taken while writing the spec (no further questions)

- "Show all" appears only when there are more than 3 transfers. Its label is "Show all {count}"; it is a left-aligned
  text button at least `size.tapMin` (48) high, in `accent` colour.
- Counts use singular and plural forms: "1 expense" / "{n} expenses", "1 person" / "{n} people".
- `?trip=` is read on the web only. iOS and Android always open the first trip; epic 2 brings the trip list.
- A `?trip=` value that is not a positive whole number shows the not-found screen without calling the API.
- The million short form lives in `money/format.ts` (`formatCentsCompact`), uses whole-number division only, and is
  unit-tested at the edges.
