# 01-trip-at-a-glance: test plan

Browser steps that prove each acceptance check in `specs/01-trip-at-a-glance-specification.md`.

**Setup.** Chromium, viewport 390x844 (repeat the 📸 checks at 1440x900 for the wide layout). Freshly seeded database
(`docker compose down -v && docker compose up`), app at http://localhost:8081, API at http://localhost:8080. Open the
browser's network tab before starting. Run the checks in order; check 15 must run last because it adds an expense.
Screenshots go to `specs/01-trip-at-a-glance-screenshots/`, named `{check}-{screen}-{width}.png`.

## 1. 📸 Trip view, demo trip
1. Open http://localhost:8081/.
2. Header reads "Lisbon & Porto".
3. Total card reads, top to bottom: "Total trip spend", `1.915,57 €` (large, bold), "1 Jun 2026 – 7 Jun 2026 · 20
   expenses", "4 people".
4. Under "Who owes whom" there are exactly three rows: "Ana pays Ben `63,75 €`", "David pays Ben `27,65 €`", "David
   pays Chloé `27,07 €`".
5. There is no "Show all" link.
6. Without scrolling, the total and the bottom edge of the third transfer card are both inside the 844 px viewport.

## 2. Trip view, demo trip, expenses
1. On `/`, scroll down to the end of the list.
2. Under "Expenses" count the rows: 20.
3. The first row is "Taxi to Porto airport" with `31,50 €` on the same line, then "7 Jun 2026 · Paid by David".
4. The dates under the names never increase from one row to the next (newest first).
5. Try to scroll sideways (shift + wheel): the page does not move; `document.documentElement.scrollWidth` equals the
   window width.

## 3. Tab bar
1. On `/`, look at the bar at the bottom: "Trip", "Balances", "+ Add expense", in that order.
2. "Trip" is highlighted and is announced as selected (`aria-selected="true"`); "Balances" is not.
3. "+ Add expense" is visibly taller than the other two tabs (56 px vs 48 px) and its bottom edge sits at the bottom of
   the viewport, separated only by the bar's padding.

## 4. Transfer rows are not buttons
1. On `/`, tap the "Ana pays Ben" row.
2. Nothing changes: no tab switch, no navigation, URL stays `/`, "Trip" is still selected.
3. Hovering the row shows no pointer cursor; the accessibility tree has no button for it.

## 5. Balances unchanged
1. On `/`, tap "Balances".
2. The per-person cards show Ana `-63,75 €`, Ben `+91,40 €`, Chloé `+27,07 €`, David `-54,72 €`, each amount on the
   same line as the name.
3. "Who owes whom" below lists the same three transfers and amounts as check 1.

## 6. 📸 Empty trip
1. Open `/?trip=2`.
2. Header "Empty weekend"; total `0,00 €`; "10 Jan 2026 – 12 Jan 2026 · 0 expenses"; "3 people".
3. There is no "Who owes whom" heading.
4. Under "Expenses": "No expenses yet. Tap + Add expense to record the first one."

## 7. 📸 Everyone even
1. Open `/?trip=3`.
2. Total `80,00 €`, "· 2 expenses".
3. "Who owes whom" contains only "Everyone is settled up." and no "pays" row.
4. Both expenses ("Lunch", "Dinner") show `40,00 €`.

## 8. Uneven cents
1. Open `/?trip=4`.
2. Total `10,00 €`, "5 Mar 2026 – 5 Mar 2026 · 1 expense" (singular).
3. "Who owes whom": "Kim pays Jon `3,33 €`" and "Lea pays Jon `3,33 €`".
4. Tap "Balances": Jon `+6,66 €`, Kim `-3,33 €`, Lea `-3,33 €`, with a plain hyphen-minus.

## 9. 📸 Very large amount and long names
1. Open `/?trip=5`.
2. The header is one line ending in "…".
3. Total `2,34 M €` on one line; "1 Apr 2026 – 30 Apr 2026 · 3 expenses"; "2 people".
4. The transfer row "Maximiliane Alexandra von Hohenzollern-Sigmaringen pays Noah" wraps; `1.172.839,46 €` stays on one
   line at the right edge of the card.
5. The 120-character expense name is cut after two lines with "…", `345.678,91 €` beside it.
6. The two other expenses show `1.000.000,00 €` in full. No sideways scroll.

## 10. 📸 More than three transfers
1. Open `/?trip=6`.
2. Total `90,00 €`.
3. "Who owes whom" shows exactly "Quinn pays Olga `20,00 €`", "Rosa pays Olga `20,00 €`", "Sam pays Olga `10,00 €`",
   then the link "Show all 4". "Tara pays Paul" is not on this screen.

## 11. Show all
1. On `/?trip=6`, tap "Show all 4".
2. The "Balances" tab is now selected and lists four transfers, including "Tara pays Paul `10,00 €`".

## 12. 📸 Unknown trip
1. Open `/?trip=999`.
2. The screen shows "This trip does not exist." and an "Open the demo trip" button.
3. Tap the button: the URL is `/` without `?trip=`, and the demo trip from check 1 is shown.

## 13. Invalid trip id
1. Open `/?trip=abc`: "This trip does not exist."
2. Open `/?trip=0`: "This trip does not exist."
3. The network tab shows no request to `/trips/abc` or `/trips/0` (no request to the API at all).

## 14. 📸 API unreachable
1. Run `docker compose stop api`, then reload `/`.
2. The screen shows "Could not reach the API at http://localhost:8080." and a "Try again" button.
3. Run `docker compose start api`, wait until it is healthy, tap "Try again": the demo trip from check 1 is shown.

## 15. The hero updates after adding (run last)
1. Open `/?trip=4`, tap "+ Add expense".
2. Under "Recorded by" pick Kim; name "Coffee"; amount `3,00`; under "Paid by" pick Kim only; leave "Split between" on
   Jon, Kim and Lea, split "Equally". Tap "Save expense".
3. Back on Trip, without a page reload (the network tab shows no new document request): total `13,00 €`, "2 expenses",
   "Who owes whom" shows "Lea pays Jon `4,33 €`" then "Kim pays Jon `1,33 €`".

## Walk results and design review (2026-10-27)

All 15 checks pass at 390x844 and at 1440x900 on a fresh seed (check 14 by stopping the API process). The ui.md rule
checks pass: no raw hex, no off-scale values, no gradient, centring only where allowed, every pressable ≥ `tapMin`.
Screenshots before the review are in `01-trip-at-a-glance-screenshots/before-review/`, after it in
`01-trip-at-a-glance-screenshots/`.

Five things a senior designer changed:
1. **The hero reads as a list row.** The total card had the same padding as every expense card. It now has
   `space.xl` padding, so the total dominates the screen.
2. **Uneven section rhythm.** Gaps between total, "Who owes whom" and "Expenses" were 16, 24 or 16 px depending on the
   trip. Every hero section is now separated by `space.xl`.
3. **Loose state text.** "Everyone is settled up." and "No expenses yet…" floated as bare text (the empty state in muted
   caption size). Both now sit in a `Card` at body size, the same shape as the rows they stand in for.
4. **Floating column on wide screens.** At 1440 px the 520 px column had no edge, so the header and tab bar stopped
   abruptly. Wider than `pageMaxWidth`, the column now has hairline `line` borders and reads as a panel.
5. **Primary message styled as secondary.** The not-found and API-error screens showed their only message in
   `inkMuted`. It is now `ink`.
