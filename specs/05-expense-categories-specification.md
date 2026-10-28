# Epic 5: Expense categories and icons — specification

Source: new feature (not in `specs/roadmap.md`; it builds on epic 4, "Edit expenses and mark a trip as paid").
Brainstorming: `specs/05-expense-categories-brainstorming.md` (rounds 1–3; every recommendation was kept).
Boundaries: `specs/guidelines/architecture.md`, `specs/guidelines/ui.md`.

## Goal

Every expense has one of 11 categories, shown as an emoji icon on its row, so a list of expenses can be scanned at a
glance. While a person types the name of a new expense, the API suggests a category from the words in the name. It
understands English, German and Spanish, common brand names and typos, and it learns from the names already used on
the same trip. The person keeps the suggestion or taps another category before saving, and can change it later by
editing the expense. Existing expenses get their category guessed once. No new package, service or dependency, and
nothing leaves the app: the matcher is plain PHP.

## Screens

All buttons are at least `size.tapMin` (48 px) high. Primary buttons are `size.tapPrimary` (56 px) high and sit at the
bottom. One new token: `size.iconBox 40` (`theme.ts` and `ui.md`).

**Categories, in this fixed order** (code → emoji → chip label, from `src/i18n`):

| Code | Icon | Label |
|---|---|---|
| `food` | 🍴 | Food |
| `groceries` | 🛒 | Groceries |
| `drinks` | 🍺 | Drinks |
| `coffee` | ☕ | Coffee |
| `fuel` | ⛽ | Fuel |
| `transport` | 🚕 | Transport |
| `flights` | ✈️ | Flights |
| `lodging` | 🏨 | Lodging |
| `activities` | 🎟️ | Activities |
| `shopping` | 🛍️ | Shopping |
| `other` | 🧾 | Other |

The code → emoji map lives in one app file (`src/expenses/categories.ts`); it is display only, like
`money/format.ts`.

### Trip view, expense rows (`TripScreen`, changed; open and paid trips)

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

- **Icon box** (`size.iconBox` square, `accentSoft`, `radius.sm`, emoji centred at `typeScale.title`): at the left of
  every row, top-aligned, on open and paid trips alike. All text moves into a column to its right. The name still
  wraps to at most 2 lines; the amount and "›" stay on the first line.
- **Screen readers:** the icon box is hidden (`importantForAccessibility="no-hide-descendants"`,
  `aria-hidden`). The row gets the label "{category label}, {name}, {amount}", e.g. "Transport, Taxi to Porto
  airport, 31,50 €".
- Tapping a row: unchanged (opens "Edit expense" on an open trip, nothing on a paid trip).
- **Empty / loading / error states:** unchanged.

### Add and edit expense (`AddExpenseScreen`, changed)

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

- **Category section**, right under "What was it?": label "Category", a hint, then 11 chips (the existing `Chip`,
  one selected at a time, `aria-checked`), each "{emoji} {label}".
- **Hint:** "Suggested from the name. Tap to change." When the name is empty: "Pick a category, or type a name to get
  a suggestion."
- **Add form, suggestion:** opens with "Other" selected. About 300 ms after the last keystroke in the name, the app
  asks `GET /trips/{id}/category-suggestion?name=…` and selects the returned category. This continues until the person
  taps any category chip; after that the selection never changes by itself (also not when the name changes or is
  cleared). Emptying the name before a chip was tapped selects "Other" again without a request. A reply for an older
  name, or one that arrives after a chip was tapped, is ignored.
- **Edit form:** the stored category is selected and is never replaced by a suggestion; no suggestion request is made.
- **Save** (`Save expense` / `Save changes`): sends the selected `category` with the rest of the input. Responses and
  errors: unchanged from epic 4, plus the field error under the chips for `422 category`.
- **Suggestion request fails** (API unreachable or any error): the selection stays as it is, with no message. Saving
  shows the existing form error card, as today.
- **Paid trip:** unchanged; the form cannot be opened (`409 trip_paid` behaviour of epic 4 still applies).
- The tab bar stays hidden, as in epic 4.

No other screen changes: Balances, My trips, the Mark as paid confirmation and the paid card stay as they are. There
are no totals per category.

## Data

**Schema** (`packages/api/src/Database/Schema.php`):

- New column `expenses.category TEXT CHECK (category IS NULL OR category IN ('food', 'groceries', 'drinks', 'coffee',
  'fuel', 'transport', 'flights', 'lodging', 'activities', 'shopping', 'other'))`. `Schema::apply` adds it with
  `ALTER TABLE expenses ADD COLUMN …` when `PRAGMA table_info(expenses)` does not list it, so existing databases keep
  their rows. New `CREATE TABLE` statements include it too. The API always writes a category; `NULL` only exists
  between adding the column and the backfill.
- **Backfill:** `bin/init-db.php`, after `Schema::apply` and the seed, gives every expense whose `category` is `NULL`
  the keyword guess for its name (keywords only, no trip learning), in id order. The seeder's expenses go through
  `ExpenseService::create` without a category, so a fresh seed gets the same guesses directly. Money figures do not
  change.
- `v_expense_list` exposes `COALESCE(e.category, 'other') AS category`.
- Index `idx_expenses_trip_id_category`: not needed (no queries by category).

**The guess** (`packages/api/src/Service/CategoryGuesser.php`, with the word lists in
`packages/api/src/Service/CategoryKeywords.php`):

1. **Name key**, used for learning: lowercase (`mb_strtolower`), accents stripped (`Transliterator` from `intl` when
   loaded, else `iconv` `ASCII//TRANSLIT`), `ß` → `ss`, every character that is not a letter or digit becomes a
   space, spaces collapsed and trimmed. "Gasolina  Repsol!" and "gasolina repsol" share the key `gasolina repsol`.
2. **Trip learning:** if an expense on the same trip has the same name key, the suggestion is its category (highest
   expense id wins; on `PUT` the expense being edited is skipped). `source: "trip"`.
3. **Keywords**, on the name key split into words, with filler words dropped (en: a, an, and, at, for, from, in, of,
   on, the, to, with; de: am, an, auf, das, der, die, für → fur, im, in, mit, und, vom, zum, zur; es: a, al, con, de,
   del, el, en, la, las, los, para, por, un, una, y). Walk the words from left to right; at each position try, in this
   order: a two-word phrase starting there ("gas station", "car rental", "boat tour", "sleeper train"), the word
   exactly, then the word with typos (5–7 letters: 1 edit; 8 or more: 2 edits; under 5: never; PHP `levenshtein()`).
   The first position that matches decides. `source: "keywords"`.
4. **Nothing matched:** `other`, `source: "none"`.

**Word lists** cover English, German and Spanish plus brands, each word in exactly one category. The build fills them;
they must include at least the words the seed table and the checks below rely on, and these explicit decisions:
"gas" → `fuel`; "bar" → `drinks` and "car" → `transport` (exact only, as all words under 5 letters); "tickets",
"entrance", "entrada", "eintritt", "museum" → `activities`; flight words ("flight", "flug", "vuelo", "jet", "Ryanair",
"Vueling", "easyJet", "Lufthansa", "airline") → `flights`, so "Ryanair tickets" → `flights` because it comes first.
"airport" is in no list (an airport is a place, not a category): "Airport taxi to Alfama" → `transport`. "boat" and
"port" are in no list ("port" would match "Porto").

**Writes:**

- `POST …/expenses`: `category` from the body, or the guess (trip learning included) when it is missing.
- `PUT …/expenses/{expenseId}`: `category` from the body; when it is missing, the stored category is kept.
- The epic 4 snapshot gains `category` (`{ name, date, amount_cents, category, paid_by, split }`), so changing only
  the category writes one `expense_changes` row and makes the expense `edited: true`. Snapshots written before this
  feature stay as they are.

**App:** `Expense.category`, `NewExpense.category`; new `src/api/expenses.ts` `suggestCategory(tripId, name)`; the
category list and emoji in `src/expenses/categories.ts`; the form state gets `category` and `categoryPicked`
(`src/expenses/expenseForm.ts`, unit tested). The app calculates no money and guesses nothing itself.

## API

Errors keep the existing shapes. All money is integer `_cents` (nothing new about money here).

| Request | Response |
|---|---|
| `GET /trips/{id}/category-suggestion?name={text}` | `200 { category, source }`, `source` ∈ `trip`, `keywords`, `none`. A missing or blank `name` gives `{ "category": "other", "source": "none" }`. Read-only: also answers on a paid trip. |
| `POST /trips/{id}/expenses` (and `?dry_run=1`) | Body as today plus optional `category`. Missing → the guess is stored. |
| `PUT /trips/{id}/expenses/{expenseId}` | Body as today plus optional `category`. Missing → unchanged. |
| `GET /trips/{id}/expenses`, and `expense` in `POST` / `PUT` responses | Each expense gets `category` (a code from the list). |

Errors, in the existing order (401 → 404 trip → 403 → 404 expense → 409 → 422):

- `GET …/category-suggestion`: `401 unauthenticated`, `404 not_found` for an unknown trip, `403 not_a_member`.
- `POST` / `PUT`: as in epic 4, plus `422` field `category`, code `invalid_category`, message "Choose one of the
  categories." for any value that is not one of the 11 codes (wrong type included). It is reported together with the
  other field errors.

## Seed data

No seed changes: trips 1–8, their expenses and the 10 accounts stay as they are, so every epic 1–4 figure holds and the
first trip created after the seed is still trip 9. The seed expenses get these categories from the guess (this table
is the contract; the PHP fixture test pins it):

| Trip | Expense | Category | Decided by |
|---|---|---|---|
| 1 Lisbon & Porto | Airport taxi to Alfama | transport 🚕 | "taxi" ("airport" is in no list) |
| 1 | Pastéis de Belém breakfast | food 🍴 | "breakfast" |
| 1 | Dinner at the harbour | food 🍴 | "dinner" |
| 1 | Tram 28 tickets | transport 🚕 | "tram" (first) |
| 1 | Museum tickets | activities 🎟️ | "museum" |
| 1 | Groceries at Pingo Doce | groceries 🛒 | "groceries" |
| 1 | Train to Sintra | transport 🚕 | "train" |
| 1 | Pena Palace tickets | activities 🎟️ | "tickets" |
| 1 | Azulejo tile souvenir | shopping 🛍️ | "souvenir" |
| 1 | Train to Porto | transport 🚕 | "train" |
| 1 | Airbnb Porto, 3 nights | lodging 🏨 | "airbnb" |
| 1 | Fado night drinks | drinks 🍺 | "drinks" |
| 1 | Port wine tasting | drinks 🍺 | "wine" ("port" is in no list) |
| 1 | Livraria Lello entrance | activities 🎟️ | "entrance" |
| 1 | Francesinha lunch | food 🍴 | "lunch" |
| 1 | Douro valley boat tour | activities 🎟️ | phrase "boat tour" |
| 1 | Sunscreen and pharmacy | shopping 🛍️ | "pharmacy" |
| 1 | Seafood dinner in Matosinhos | food 🍴 | "seafood" |
| 1 | Metro day passes | transport 🚕 | "metro" |
| 1 | Taxi to Porto airport | transport 🚕 | "taxi" |
| 3 Even split | Lunch | food 🍴 | "lunch" |
| 3 | Dinner | food 🍴 | "dinner" |
| 4 Three-way taxi | Taxi | transport 🚕 | "taxi" |
| 5 Great tour … | Private jet charter | flights ✈️ | "jet" |
| 5 | Yacht week | activities 🎟️ | "yacht" |
| 5 | Overnight sleeper train from Lisbon to Madrid … (120 characters) | transport 🚕 | phrase "sleeper train" |
| 6 Big group | Group dinner | food 🍴 | "dinner" |
| 6 | Boat tickets | activities 🎟️ | "tickets" ("boat" is in no list) |
| 7 Madrid weekend | Tapas at Mercado de San Miguel | food 🍴 | "tapas" |
| 7 | Prado Museum tickets | activities 🎟️ | "museum" |
| 8 Ski week | Ski passes | activities 🎟️ | "ski" (exact) |

**Money in the checks.** Trip 7 "Madrid weekend" as seeded: total `78,30 €`, Ana pays Chloé `9,15 €`. Changing only
a category (check 8) changes no figure. Adding "Dinner and wine" `20,00 €` on 14 Sep 2026, paid by Ana, split equally
between Ana and Chloé (check 5) gives, calculated with the current API code on a fresh in-memory database after the
seed:

| Total | Ana | Chloé | Transfer |
|---|---|---|---|
| `98,30 €` (3 expenses) | paid `50,00 €`, share `49,15 €`, net `+0,85 €` | paid `48,30 €`, share `49,15 €`, net `-0,85 €` | Chloé pays Ana `0,85 €` |

## Tests

- **PHP (`packages/api/tests`, run through `tests/functional`):**
  - `CategoryGuesserTest`: a fixture list of about 120 names with the expected category and source, every entry
    exact. It covers English, German and Spanish, brands, typos ("gasolne", "restaruant", "Abendesen"), phrases, the
    explicit decisions in Data (gas, bar, car, tickets, Ryanair tickets, airport, port, boat), names that give `other`,
    the 120-character name, accents and `ß` in the name key, and every row of the seed table.
  - Learning: the same name key on the same trip returns that expense's category with `source: "trip"` (highest id
    wins); another trip is not affected; `PUT` skips the edited expense.
  - Schema: applying the schema to a database created without the column adds it and keeps every row; the backfill
    sets the seed table's categories; applying twice changes nothing.
  - Writes: `POST` with and without `category`; `PUT` without `category` keeps it; `invalid_category` with the other
    field errors; changing only the category writes one change record with `category` in both snapshots and sets
    `edited`; the endpoint's 401 / 404 / 403 and its answer on a paid trip; `category` in list, create and edit
    responses.
  - Existing tests still pass, apart from the new field.
- **TypeScript (`tests/unit`):** the form state: a new form starts on `other` and not picked; a suggestion replaces
  the category only while not picked; tapping a chip sets picked; the edit form starts from the stored category and
  picked. `suggestCategory` sends `GET` with the encoded name (fake `fetch`). Every code has an emoji and a label.
- **Playwright (`tests/e2e`, 390x844):** a new `categories.test.ts` with one screenshot per 📸 check, on a fresh seed,
  in the order of the checks.

## Acceptance checks

Viewport 390x844. Freshly seeded database. App at http://localhost:8081. Every demo password is `travel-demo-2026`.
Run the checks in order: checks 5–10 build on each other.

1. 📸 **Icons on the trip view.** Log in as `ana@example.com` and open "Lisbon & Porto". Every expense row starts with
   an icon box. "Taxi to Porto airport `31,50 €`" shows 🚕, "Airbnb Porto, 3 nights" 🏨, "Groceries at Pingo Doce" 🛒,
   "Fado night drinks" 🍺, "Dinner at the harbour" 🍴 and "Azulejo tile souvenir" 🛍️. The amounts and "›" still sit
   on the first line of each row, and the page does not scroll sideways.
2. 📸 **Category section in the add form.** Open "Madrid weekend" and tap "+ Add expense". Under "What was it?" the
   section "Category" shows the hint "Pick a category, or type a name to get a suggestion." and 11 chips in the table's
   order, each at least 48 px high, with "🧾 Other" selected.
3. 📸 **Suggestion with a typo.** Type "Gasolne Repsol" as the name. Within a second "⛽ Fuel" is selected and the hint
   reads "Suggested from the name. Tap to change.".
4. **Languages, first word and no match.** Replace the name, waiting a second each time: "Abendessen im Hotel" selects
   "🍴 Food"; "Hotel Abendessen" selects "🏨 Lodging"; "Café con churros" selects "☕ Coffee"; "Airport taxi" selects
   "🚕 Transport"; "Xyzzy" selects "🧾 Other"; clearing the name selects "🧾 Other" and shows the empty-name hint.
5. 📸 **A tapped category sticks, then save.** Type "Dinner": "🍴 Food" is selected. Tap "🍺 Drinks", then complete the
   name to "Dinner and wine" and wait a second: "🍺 Drinks" stays selected. Enter date `2026-09-14`, amount `20,00`,
   "Paid by" Ana, and tap "Save expense". The trip view shows total `98,30 €`, "Chloé pays Ana `0,85 €`", and the row
   "Dinner and wine `20,00 €`" with 🍺.
6. **The trip learns.** Tap "+ Add expense" and type "dinner and WINE": "🍺 Drinks" is selected (from the expense of
   check 5). Tap "Cancel": the total is still `98,30 €`.
7. **Learning stays in its trip.** Go to "‹ My trips", open "Lisbon & Porto", tap "+ Add expense" and type "Dinner and
   wine": "🍴 Food" is selected. Tap "Cancel".
8. 📸 **Change only the category.** Open "Madrid weekend" and tap "Tapas at Mercado de San Miguel". "Edit expense" shows
   "🍴 Food" selected. Tap "🍺 Drinks" and "Save changes". The row shows 🍺 and "Edited"; the total is still `98,30 €`
   and "Chloé pays Ana `0,85 €`".
9. **The edit form never re-suggests.** Tap "Prado Museum tickets": "🎟️ Activities" is selected. Change the name to
   "Prado dinner" and wait a second: "🎟️ Activities" stays selected. Tap "Cancel": the row still reads "Prado Museum
   tickets" with 🎟️ and no "Edited".
10. **Paid trip keeps its icons.** Tap "Mark as paid" and confirm. The paid view shows the rows with their icons:
    "Dinner and wine" 🍺, "Prado Museum tickets" 🎟️ and "Tapas at Mercado de San Miguel" 🍺, without "›".
11. 📸 **Long name and very large amount.** Log in as `noah@example.com` and open the long-name trip. The 120-character
    sleeper train row shows 🚕, its name wraps to 2 lines right of the icon, and its amount `345.678,91 €` stays on the
    first line. "Private jet charter `1.000.000,00 €`" shows ✈️ and "Yacht week" 🎟️. The total still reads `2,34 M €`
    and the page does not scroll sideways.
12. **Screen reader label.** As Ana on "Lisbon & Porto", the row "Taxi to Porto airport" is a button whose accessible
    name is "Transport, Taxi to Porto airport, 31,50 €", and the emoji is not part of the accessible text.
13. 📸 **API unreachable.** As `ben@example.com`, open "Lisbon & Porto" and tap "+ Add expense". Block the API, type
    "Taxi" and wait a second: "🧾 Other" stays selected and no error message appears. Enter amount `10,00`, choose
    "Paid by" Ben and tap "Save expense": the existing form error card appears and the input stays. Unblock the API and
    type a space after "Taxi": "🚕 Transport" is selected.
14. **The suggestion endpoint.** In the console with Ana's token: `GET /trips/1/category-suggestion?name=gasolne`
    answers `{ "category": "fuel", "source": "keywords" }`; `GET /trips/7/category-suggestion?name=Dinner%20and%20wine`
    answers `{ "category": "drinks", "source": "trip" }` (Madrid is paid since check 10: still `200`);
    `?name=Xyzzy` and a missing `name` answer `{ "category": "other", "source": "none" }`. Without a token: `401`.
    `GET /trips/999/category-suggestion?name=x`: `404 not_found`. With Ben's token on trip 7: `403 not_a_member`.
15. **Categories on write.** With Hugo's token (`hugo@example.com`, trip 3 "Even split"): `POST /trips/3/expenses`
    with a valid body and `"category": "pets"` answers `422` with `errors.category.code` `invalid_category`. The same
    body without `category` and with the name "Taxi" answers `201` with `expense.category` `transport`. `PUT` of that
    expense with only `"category": "other"` changed answers `200` with `category` `other` and `edited: true`; a `PUT`
    without `category` keeps `other`.
16. **Seed categories.** With Ana's token, `GET /trips/1/expenses` returns the categories of the seed table for all 20
    expenses; `GET /trips/7/expenses` on a fresh seed returns `food` for "Tapas at Mercado de San Miguel" and
    `activities` for "Prado Museum tickets".
17. **Earlier epics still hold.** With a fresh seed, the epic 1–4 checks show the same figures as before.

## Out of scope

Excluded in the rounds: icons only without a way to change them, a manual picker without suggestions, categories that
trip members define, an external AI model or any service outside the app, a sound-alike (`metaphone`) match, learning
across trips or users, more languages than English, German and Spanish, a separate corrections table, a separate
category picker screen or a scrolling chip row, re-suggesting in the edit form or after a chip was tapped, a message
when the suggestion request fails, totals or charts per category (Balances, My trips), a monochrome or SVG icon set
(new dependency), new seed trips, and a hit-rate target instead of an exact fixture list. Also not included: showing
the category in the change history (still never shown in the app), filtering or sorting expenses by category.

## Check on iOS and Android

- Every emoji renders in colour in the platform font, centred in its 40×40 box, on both platforms (✈️ and 🎟️ use a
  variation selector).
- The 11 chips wrap without clipping at the largest accessibility text size, and each still responds across 48 px.
- VoiceOver and TalkBack read a row as "Transport, Taxi to Porto airport, 31,50 €" and skip the emoji.
- Typing quickly in the name field on a slow network never moves the cursor or drops characters while suggestions
  arrive.
- Both platforms still build: Expo export for `ios` and `android` succeeds in the container.
