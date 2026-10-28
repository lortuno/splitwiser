# Expense categories and icons — brainstorming

Source: new feature (not in `specs/roadmap.md`; closest to epic 4, which added editing expenses). Boundaries:
`specs/guidelines/architecture.md`, `specs/guidelines/ui.md`. Append-only: questions and answers are never changed
once written. Answer by moving the `[x]` or adding a note under the question.

## What exists today (for reference)

- **Expenses have no category.** `expenses` holds name, `spent_on`, `amount_cents`, `recorded_by`, `split_type` and
  `created_at`. Payers and splits are separate input rows; shares, totals and balances come from the `v_*` views.
  Names are free text, 1–120 characters, in any language and with typos (seed: "Taxi to Porto airport", "Tapas at
  Mercado de San Miguel", "Private jet charter", a 120-character sleeper train name).
- **Add / edit expense form** (`AddExpenseScreen`): name, date, amount (`decimal-pad`), "Paid by" and "Split between"
  chips, split type, split preview from `POST …/expenses?dry_run=1`, primary button at the bottom. Edits go through
  `PUT /trips/{id}/expenses/{expenseId}` and store before/after snapshots in `expense_changes` (epic 4). A paid trip
  takes no new or edited expenses (`409 trip_paid`).
- **Expense rows** (`TripScreen`): "{name} {amount} ›", "{date} · Paid by …", "Recorded by … · Split between n", and
  "Edited". No icon anywhere in the app today; the only symbols are "›", "✓" and "‹", in the platform font.
- **Fixed by the guidelines:** no new package, service or dependency without an Inventory entry
  (`architecture.md` rule 11); the app derives nothing and the API owns all rules; colours only from `theme.ts` (one blue
  accent, green/red only for money); tap targets `size.tapMin` 48 / `size.tapPrimary` 56.
- **PHP built-ins available without a dependency:** `levenshtein()`, `similar_text()`, `metaphone()`, `soundex()`,
  `mb_strtolower()`. Whether the `intl` extension (accent stripping via `Transliterator`) is in the PHP image is to be
  checked during the build; `iconv` transliteration is the fallback.
- **Pilot rule:** expense names can contain people's names, so sending them to an external AI service is not
  assumed to be allowed.

---

## Round 1

Functionality and the rules behind it.

### Q1. What should the feature do for a person?
- [x] Each expense gets a category, shown as an icon on its row. When typing the name, the app suggests a category; the person can keep it or pick another before saving, and can change it later by editing. (Recommended)
- [ ] Icons only: the category is always guessed from the name, the person cannot change it.
- [ ] Categories only as a manual picker, no guessing.

### Q2. Which categories?
A short, fixed list keeps icons recognisable and the matcher testable.
- [x] 10 fixed categories plus a fallback: Food (restaurant, dinner), Groceries, Drinks & nightlife, Coffee & snacks, Fuel, Transport (taxi, train, bus, car rental), Flights, Lodging, Activities & tickets, Shopping, and "Other". (Recommended)
- [ ] A smaller list of 6: Food, Transport, Fuel, Lodging, Activities, Other.
- [ ] Trip members can create their own categories.

### Q3. How is the category guessed?
- [x] A keyword matcher in the API: normalise the name (lowercase, strip accents, split into words, drop filler words), look words up in a synonym list per category, and only if nothing matches allow typos by edit distance (none under 5 letters, 1 edit for 5–7 letters, 2 edits for 8 or more). No confident match gives "Other". (Recommended: no dependency, instant, works offline, fully testable.)
- [ ] The same, plus a sound-alike check (`metaphone`) for words the edit distance misses.
- [ ] An external AI model (e.g. the Claude API) classifies the name. Needs an API key, costs per call, and sends expense names outside the app.

### Q4. Should the guess learn from people's choices?
- [x] Yes: when someone picks a different category than the guess, the API remembers "normalised name → category" for that trip, and later expenses with the same normalised name on that trip get it first. (Recommended: corrections stay inside the trip's group.)
- [ ] Yes, across all trips and users (one shared memory for the whole app).
- [ ] No learning; only the synonym lists.

### Q5. Which languages must the synonym lists cover?
- [x] English, German and Spanish, plus common brand names (Shell, Repsol, Aral, Uber, Ryanair, Airbnb, Booking…). (Recommended)
- [ ] English only.
- [ ] English, German, Spanish, French, Italian and Portuguese.

### Q6. What if a name matches several categories ("Taxi to Porto airport": taxi → Transport, airport → Flights)?
- [x] The first matching word in the name wins ("Taxi…" → Transport). (Recommended: easy to explain and predictable.)
- [ ] A fixed priority between categories decides (e.g. Lodging > Flights > Transport > Fuel > Food > …).
- [ ] The category with the most matching words wins; ties go to the first word.

### Q7. What do the icons look like?
- [x] Emoji in the platform font (🍴 🛒 🍺 ☕ ⛽ 🚕 ✈️ 🏨 🎟️ 🛍️ 🧾): no new dependency, readable at a glance, but in colour next to the blue-grey palette. (Recommended)
- [ ] A monochrome icon set (`@expo/vector-icons`, tinted with `inkMuted`): matches the design, but is a new dependency with an Inventory entry, and brings icon fonts to the web build.
- [ ] Our own small set of SVG icons drawn with tokens (needs `react-native-svg`, also a new dependency).

### Q8. What happens to expenses saved before this feature (all seed expenses)?
- [x] The API guesses their category once when the schema is applied (stored like a chosen one), so every row has an icon from day one. Seed figures do not change. (Recommended)
- [ ] They stay without a category and show the "Other" icon until someone edits them.
- [ ] The category is never stored: it is always guessed on the fly from the current name, except when someone picked one.

- [x] Round 1 answered (tick this when you have answered every question above)

## Round 2

Round 1 answers: every recommendation was kept (category per expense with a suggestion the person can change; 10
categories plus "Other"; keyword matcher in the API with edit-distance typos; learning per trip; English, German,
Spanish and brands; first matching word wins; emoji; existing expenses guessed once).

Screens and interaction on a phone. Correct the wireframes directly under each question if something is off.

### Q1. Expense row on the trip view (open and paid trip)
```
┌──────────────────────────────────────┐
│ ┌──────────────────────────────────┐ │
│ │ ┌────┐ Taxi to Porto      31,50 € ›│ │  icon box 40×40, accentSoft,
│ │ │ 🚕 │ airport                     │ │  radius.sm, emoji at title 20;
│ │ └────┘ 7 Jun 2026 · Paid by David  │ │  text column starts right of it
│ │        Recorded by Chloé · Split…  │ │
│ │        Edited                      │ │
│ └──────────────────────────────────┘ │
```
- [x] Icon box at the left of every row, top-aligned, on open and paid trips alike; all text moves right of it. The box needs one new token, `size.iconBox 40`. (Recommended)
- [ ] The emoji inline before the name, no box ("🚕 Taxi to Porto airport"), no new token.
- [ ] The emoji at the right, next to the amount.

### Q2. Category in the add / edit form
```
┌──────────────────────────────────────┐
│ Add expense                  Cancel  │
├──────────────────────────────────────┤
│ What was it?                         │
│ ┌──────────────────────────────────┐ │
│ │ Gasolne Repsol                   │ │
│ └──────────────────────────────────┘ │
│ Category                             │  label, as the other sections
│ Suggested from the name. Tap to      │  hint, caption inkMuted
│ change.                              │
│ [✓ ⛽ Fuel] [🍴 Food] [🛒 Groceries]  │  chips (existing Chip, 48 high),
│ [🍺 Drinks] [☕ Coffee] [🚕 Transport]│  wrapping, all 11 visible,
│ [✈️ Flights] [🏨 Lodging]             │  fixed order; selected = accent
│ [🎟️ Activities] [🛍️ Shopping]          │
│ [🧾 Other]                            │
│ Date (YYYY-MM-DD)     Amount (€)     │  rest of the form unchanged
│ …                                    │
├──────────────────────────────────────┤
│ [          Save expense            ] │
└──────────────────────────────────────┘
```
- [x] A "Category" section right under the name: all 11 categories as wrapping chips (the existing `Chip`, one selectable), the suggested one pre-selected, with the hint "Suggested from the name. Tap to change." (Recommended: one tap to correct, no extra screen.)
- [ ] One button under the name ("⛽ Fuel ›") that opens a separate category picker screen.
- [ ] A single horizontally scrolling row of chips.

### Q3. When does the suggestion change while typing?
- [x] Add form: the suggestion follows the name (about 300 ms after the last keystroke) until the person taps a category chip; after that it never changes by itself. Edit form: the stored category stays selected and is never replaced by a suggestion. (Recommended)
- [ ] The suggestion always follows the name, even after a manual pick.
- [ ] The suggestion is made once, when the name field loses focus.

### Q4. Empty name and no match
- [x] Empty name: "Other" is selected and the hint reads "Pick a category, or type a name to get a suggestion.". A name without a match: "Other" stays selected with the normal hint. Saving always sends a category, so "Other" is a valid choice. (Recommended)
- [ ] With an empty name no chip is selected, and saving without a category is an error.

### Q5. Screen readers and long names
- [x] The icon box is hidden from screen readers on the row; the row's label gets the category name instead ("Transport, Taxi to Porto airport, 31,50 €"). Long names keep wrapping to 2 lines right of the icon; the amount and "›" stay on the first line. (Recommended)
- [ ] The emoji itself is read out (e.g. "taxi").

### Q6. Other screens
- [x] No other screen changes: Balances, My trips, Mark as paid and the paid trip view stay as they are (rows on a paid trip show their icon, per Q1). No totals per category. (Recommended)
- [ ] Also show a spend per category on the Balances tab (needs its own round).

- [x] Round 2 answered (tick this when you have answered every question above)

## Round 3

Round 2 answers: every recommendation was kept (icon box at the left of every row with a new `size.iconBox 40`;
category chips under the name; the suggestion follows the name until a chip is tapped, never in the edit form; "Other"
for an empty name or no match; icon hidden from screen readers with the category in the row's label; no other screen
changes).

Data, API, edge cases and the test data they need.

### Q1. Where is the category stored?
- [x] A new column `expenses.category TEXT CHECK (category IN (…11 codes…))`, added by `Schema::apply` when it is missing (SQLite `ALTER TABLE … ADD COLUMN`, so existing databases keep their data). Codes: `food`, `groceries`, `drinks`, `coffee`, `fuel`, `transport`, `flights`, `lodging`, `activities`, `shopping`, `other`. (Recommended)
- [ ] A separate input table `expense_categories (expense_id PRIMARY KEY, category)`, which needs no `ALTER TABLE`.

### Q2. How does "learning per trip" work, and in which order is the guess made?
- [x] No extra table: the API looks at the trip's own expenses first. If an earlier expense on the trip has the same normalised name ("Gasolina Repsol" = "gasolina repsol"), its category is the suggestion (the most recent one wins). Only otherwise the keywords decide: phrases ("gas station", "car rental"), then exact words, then typos. This learns from corrections and from confirmed guesses alike. (Recommended)
- [ ] A separate table that records only corrections (name → category, who, when); the latest correction wins.

### Q3. How does the form get a suggestion?
- [x] A new read-only endpoint `GET /trips/{id}/category-suggestion?name=…` → `200 { category, source }`, with `source` one of `trip`, `keywords` or `none` (`none` means "other" because nothing matched). Same 401 / 404 / 403 checks as other trip routes; works on a paid trip too, as it writes nothing. (Recommended)
- [ ] Add the suggestion to the split preview (`?dry_run=1`), which only runs once an amount is entered.

### Q4. Request and response shapes for expenses
- [x] `POST` and `PUT …/expenses` take an optional `category`. When it is missing, the API stores its own guess (so older clients and the seeder keep working); an unknown code is `422` on the field `category` with code `invalid_category` ("Choose one of the categories."). Every expense in responses gets `category`. The edit snapshot (epic 4) includes `category`, so changing only the category counts as an edit and shows "Edited". (Recommended)
- [ ] `category` is required on every `POST` and `PUT`; a missing one is `422`.

### Q5. Ambiguous and short words
- [x] Keep a small list of explicit decisions, each pinned by a test: "gas" → Fuel (travel context, never a utility bill); "bar" → Drinks and "car" → Transport only as exact words, never by typo (words under 5 letters are never typo-matched anyway); "tickets" → Activities unless a flight word comes first ("Ryanair tickets" → Flights). (Recommended)
- [ ] Leave ambiguous words out of every list, so they give "Other".

### Q6. How is the matcher's quality tested?
- [x] A PHP fixture list of about 120 expense names with the expected category, covering the three languages, brands, typos ("gasolne", "restaruant", "Abendesen"), multi-word phrases, the ambiguous words of Q5, names that must give "Other", and the 120-character seed name. Every entry must match exactly; the list grows whenever a wrong guess is reported. (Recommended)
- [ ] Measure a hit rate on the list and accept at least 90 %.

### Q7. Seed data
- [x] No new seed trips or expenses, so every epic 1–4 check and figure stays as it is and the first trip created after the seed is still trip 9. The existing seed expenses get their category from the one-time guess (Round 1 Q8); the spec lists the category each one gets, calculated with the real matcher. The checks add and edit expenses through the app. (Recommended)
- [ ] Add a seed trip whose expenses cover every category (shifts the id of the first trip created after the seed to 10).

### Q8. What can go wrong in the form?
- [x] Suggestion request fails (API unreachable): the selected chip stays as it was, without an error message; saving shows the existing error card as today. Paid trip: unchanged (no add or edit possible, rows still show icons). A guess never blocks typing: a reply that arrives after the person tapped a chip, or for an older name, is ignored. (Recommended)
- [ ] Show a small "Could not get a suggestion" hint under the chips when the request fails.

- [x] Round 3 answered (tick this when you have answered every question above)

## Decisions made while writing the specification

Round 3 answers: every recommendation was kept. These details were settled in
`specs/05-expense-categories-specification.md` and can be challenged there:

- **"airport" is in no keyword list.** Round 1 Q6 used "airport → Flights" as an example, but with "first matching
  word wins" the seed expense "Airport taxi to Alfama" would then show ✈️. An airport is a place, not a category, so
  that name gives Transport; "Taxi to Porto airport" stays Transport too. Likewise "port" (would match "Porto") and
  "boat" ("boat tour" is a phrase for Activities, "ferry" is Transport) are in no list.
- **`PUT` without `category` keeps the stored one.** Round 3 Q4 said a missing category is guessed; for an edit that
  would silently overwrite a category someone picked, so the guess applies to `POST` only.
- **The column is nullable** (`category IS NULL OR …`): SQLite cannot add a `NOT NULL` column without a default to a
  table with rows, and a default of `other` would hide which rows still need the one-time guess. The API always
  writes a category; `v_expense_list` shows `COALESCE(category, 'other')`.
- **The backfill uses keywords only**, without trip learning, in id order, and runs in `bin/init-db.php` after the
  schema and the seed.
- **Short chip labels** (Food, Drinks, Coffee, Activities…) as in the Round 2 wireframe, not the longer names of
  Round 1 Q2 ("Drinks & nightlife"), so the chips fit at 390 px.
- **The seed categories** in the spec are the contract the word lists must meet; the matcher does not exist yet, so
  they are pinned by the PHP fixture test during the build rather than calculated now. The only new money figures
  (Madrid after adding "Dinner and wine" `20,00 €`: total `98,30 €`, Chloé pays Ana `0,85 €`) were calculated with
  the current API code on a fresh in-memory database.
