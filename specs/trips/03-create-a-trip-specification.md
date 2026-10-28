# Epic 3: Create a trip — specification

Source: `specs/roadmap.md`, epic 3. Brainstorming: `specs/trips/03-create-a-trip-brainstorming.md` (rounds 1–4).
Boundaries: `specs/guidelines/architecture.md`, `specs/guidelines/ui.md`.

## Estimate

Development hours only, as defined in "Estimates" in AGENTS.md. Rows are append-only.

| Date | Task | Estimate (h) | Actual (h) |
|---|---|---|---|
| 2026-10-28 | Build the epic | 1.5 | 0.25 |

## Goal

Anyone logged in can start a trip: a name, a start and end date, and the people travelling. The creator is added
automatically and linked to their account. Everyone else is a name, with an optional email. If that email belongs to
an account, now or at a later sign-up, the person is linked to it and the trip shows up in that person's "My trips".
`people.user_id` is a nullable foreign key to `users`, and `people` never holds an email. A pending email lives in
`trip_invites` until it is linked. Accounts get an editable **display name**, the only name the app shows for a
linked person, and a `last_login_at`. Saving a new trip opens its empty trip view (`0,00 €`, everyone settled), and
expenses can be recorded at once, including for name-only members. No new package, service or dependency.

## Screens

All buttons are at least `size.tapMin` (48 px) high. Primary buttons are `size.tapPrimary` (56 px) high and sit at the
bottom. The trip view, Balances, the add expense form, Login and Sign-up keep their layout. Wherever they show a
person, they show the name from the API (the display name for linked people, Round 2 Q3). The sign-up field "Your
name" sets the display name.

### My trips (`MyTripsScreen`, changed)

```
┌──────────────────────────────────────┐
│ My trips          Your name  Log out │  header: title 20 bold;
├──────────────────────────────────────┤  two text buttons, 48 high, accent
│ Logged in as Ana                     │  caption, inkMuted (display name)
│ ┌──────────────────────────────────┐ │
│ │ Madrid weekend                   │ │  trip cards unchanged
│ │ 12 Sep 2026 – 14 Sep 2026        │ │
│ │ Total                    78,30 € │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Lisbon & Porto                   │ │
│ │ 1 Jun 2026 – 7 Jun 2026          │ │
│ │ Total                 1.915,57 € │ │
│ └──────────────────────────────────┘ │
│                                      │
│            (list scrolls)            │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │            + New trip            │ │  primary, accent, 56 high,
│ └──────────────────────────────────┘ │  fixed at the bottom
└──────────────────────────────────────┘
```

- **Your name** (`size.tapMin`): opens "Your name".
- **Log out**: unchanged from epic 2.
- **+ New trip** (`size.tapPrimary`, fixed at the bottom, outside the scrolling list): opens "New trip". It shows in
  the empty, loaded and long-list states. It is hidden while the list is loading and in the error state.
- **Empty state (changed text):** a card "You are not on any trip yet. Start one with "+ New trip", or ask a friend to
  add you with your email."
- **Loading / error:** unchanged from epic 2 (centred spinner "Loading…"; "Could not reach the API at {url}." with
  "Try again").
- Trip cards: unchanged. The name wraps to at most 2 lines and ends in "…".

### New trip (`NewTripScreen`, new)

```
┌──────────────────────────────────────┐
│ ‹ My trips                           │  back text button, 48 high
│ New trip                             │  title 20 bold
├──────────────────────────────────────┤
│ Trip name                            │  caption bold
│ ┌──────────────────────────────────┐ │
│ │ Summer in Sicily                 │ │  autoCapitalize words
│ └──────────────────────────────────┘ │
│ Start date          End date         │
│ ┌───────────────┐   ┌──────────────┐ │  two fields side by side,
│ │ 2026-10-27    │   │ 2026-10-27   │ │  prefilled with today,
│ └───────────────┘   └──────────────┘ │  YYYY-MM-DD
│ The end date is before the start.    │  FieldError under End date
│                                      │
│ People                               │  caption bold
│ ┌──────────────────────────────────┐ │
│ │ Ana (you)                        │ │  fixed row, cannot be removed
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │  one card per added person
│ │ Name                             │ │
│ │ ┌──────────────────────────────┐ │ │
│ │ │ Ben                          │ │ │
│ │ └──────────────────────────────┘ │ │
│ │ Email (optional)                 │ │  email-address keyboard,
│ │ ┌──────────────────────────────┐ │ │  no autocapitalise/correct
│ │ │ ben@example.com              │ │ │
│ │ └──────────────────────────────┘ │ │
│ │                          Remove  │ │  text button, 48 high
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Name                             │ │
│ │ ┌──────────────────────────────┐ │ │
│ │ │ Grandma                      │ │ │
│ │ └──────────────────────────────┘ │ │
│ │ Email (optional)                 │ │
│ │ ┌──────────────────────────────┐ │ │
│ │ │                              │ │ │
│ │ └──────────────────────────────┘ │ │
│ │                          Remove  │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │           + Add person           │ │  secondary (accentSoft), 48 high
│ └──────────────────────────────────┘ │
│            (form scrolls)            │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │           Create trip            │ │  primary, 56 high, fixed at
│ └──────────────────────────────────┘ │  the bottom
└──────────────────────────────────────┘
```

- **Opens with:** empty trip name, both dates prefilled with today's date (`YYYY-MM-DD`, from the device clock), the
  fixed row "{display name} (you)", and one empty person card.
- **‹ My trips** (`size.tapMin`): back to "My trips" at once. The input is dropped and nothing asks for confirmation.
- **Trip name:** `autoCapitalize="words"`. **Dates:** plain text fields, like the add expense date. The app does not
  check them. The API does.
- **Person card:** "Name" (`autoCapitalize="words"`) and "Email (optional)" (`keyboardType="email-address"`, no
  autocapitalise, no autocorrect). **Remove** (`size.tapMin`) deletes that card. Every card can be removed, even the
  last one. The API then answers `too_few`.
- **+ Add person** (`size.tapMin`, `accentSoft` background): appends an empty card and focuses its name. It is hidden
  once there are 20 people including the creator (19 cards).
- **Create trip** (`size.tapPrimary`, fixed at the bottom): sends `POST /trips` with the trimmed values the user typed.
  Empty email fields are sent as `null`. While the request runs the button reads "Creating trip…" and is disabled.
  - `201` → the new trip view opens on the Trip tab, built from the response (`trip` + `summary`). On the web the URL
    becomes `?trip={id}`.
  - `422` → each message appears under its field (`FieldError`, red field border). `people` errors appear under the
    "People" label, and `people.{i}.*` errors appear under that card's field. Above the button, the owesSoft card reads
    "Please fix the fields marked in red." The input stays.
  - API unreachable → the owesSoft card above the button reads "Could not reach the API at {url}." The input stays and
    the button can be tapped again.
  - `401` → handled by the app shell (Login, "Your session has ended."), as in epic 2.
- **Loading / empty:** none. The form needs no data beyond the logged-in user, which the app already has.

### Your name (`YourNameScreen`, new)

```
┌──────────────────────────────────────┐
│ ‹ My trips                           │  back text button, 48 high
│ Your name                            │  title 20 bold
├──────────────────────────────────────┤
│ This is how you appear on all your   │  body, inkMuted
│ trips.                               │
│                                      │
│ Name                                 │
│ ┌──────────────────────────────────┐ │  prefilled with the current
│ │ Ana                              │ │  display name
│ └──────────────────────────────────┘ │
│ Enter your name.                     │  FieldError
│                                      │
│            (flexible space)          │
│ ┌──────────────────────────────────┐ │
│ │               Save               │ │  primary, 56 high, bottom
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

- **‹ My trips:** back without saving.
- **Save** (`size.tapPrimary`, bottom): `PATCH /me { display_name }`. While the request runs it reads "Saving…" and is
  disabled. `200` → back to "My trips", which reloads and shows "Logged in as {new name}". `422` → the message under the
  field. API unreachable → the owesSoft card "Could not reach the API at {url}." above the button, and the input stays.
- **Loading / empty:** none. The field is prefilled from the user the app already has.

### Trip view, Balances, Add expense (unchanged layout)

- After "Create trip", the trip view shows the trip name in the header (1 line, "…"), `0,00 €`, "{start} – {end} ·
  0 expenses", "{n} people" and "No expenses yet. Tap + Add expense to record the first one." As in epic 1 for a trip
  without expenses, "Who owes whom" is not shown there; the Balances tab shows "Everyone is settled up."
- Name-only members appear in "Paid by" and "Split between" exactly like linked members.

## Data

**Schema changes** (`packages/api/src/Database/Schema.php`):

- `users.name` → **`display_name TEXT NOT NULL`**. New **`last_login_at TEXT NULL`**: NULL for seeded accounts, set
  by the API at sign-up and at every login, never shown.
- `people`: unchanged. `name TEXT NOT NULL` keeps the name typed by the creator, and `user_id INTEGER NULL REFERENCES
  users (id)` links an account. `people` has no email column.
- New table **`trip_invites`**: `person_id INTEGER PRIMARY KEY REFERENCES people (id) ON DELETE CASCADE`, `email TEXT
  NOT NULL` (trimmed, lowercased), index on `email`. A row exists only while the email has no account.
- **Shown name** = `COALESCE(users.display_name, people.name)`. It is used in `TripRepository::findMembers`,
  `v_member_balances.name`, `v_expense_list` (`recorded_by_name`, `paid_by_json`, `split_between_json`) and the
  transfers built from the balances. A rename therefore shows at once on every trip, past expenses included.
- Existing dev databases are reset once with `docker compose down -v`, as in epic 2. There is no migration.

**Writes:**
- `POST /trips`, in one transaction: insert the trip. Insert the creator's person (`name` = their display name,
  `user_id` = the user) as the first member. For each other person, insert the person (typed name) and the member row.
  With an email that belongs to an account, set `user_id`. With an email that has no account, insert a `trip_invites`
  row.
- `POST /auth/signup`, in its transaction: create the user and session, then for every `trip_invites` row with the
  same email, set `people.user_id` to the new user and delete the invite.
- `POST /auth/login`: sets `last_login_at`. `PATCH /me`: updates `display_name`.

**Reads:** `GET /trips` and membership are unchanged. Membership is a person on the trip with `user_id` = the user. A
pending invite does not make anyone a member.

**App:** the `User` DTO becomes `{ id, display_name, email }`. New `src/api/trips.ts` `createTrip` and
`src/api/auth.ts` `updateMe`. A small pure helper (e.g. `src/trips/newTripInput.ts`) turns the form state into the
request body: names and emails trimmed, an empty email → `null`, the creator never included. The app adds, subtracts
and divides no money (architecture rule 6).

## API

Errors keep the existing shapes: `{ error: { code, message } }`, and for validation `422 { errors: { field: { code,
message } } }`. All money is integer `_cents`. CORS `Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS`.

| Request | Response |
|---|---|
| `POST /trips` `{ name, start_date, end_date, people: [{ name, email? }] }` | `201 { trip: { id, name, start_date, end_date, total_cents: 0, members: [{ id, name }] }, summary }`. `members` starts with the creator. `summary` has the shape of `GET /trips/{id}/summary` (`total_cents: 0`, `expense_count: 0`, every balance `0`, `transfers: []`). The creator is never in `people`. A `people` entry with the creator's email is a `duplicate_email`. |
| `PATCH /me` `{ display_name }` | `200 { id, display_name, email }`. `422` `display_name`: `required` ("Enter your name."), `too_long` ("Use at most 60 characters."), checked after trimming. Names may repeat (Round 2 Q5). |
| `GET /me` | `200 { id, display_name, email }` (was `name`). |
| `POST /auth/signup` `{ display_name, email, password }` | `201 { token, user: { id, display_name, email } }`. The field `name` becomes `display_name`, with the same rules and messages as before. Pending invites for the email are linked (see Data). |
| `POST /auth/login` | `200 { token, user: { id, display_name, email } }`. Sets `last_login_at`. |
| `GET /trips`, `GET /trips/{id}`, `/expenses`, `/summary` | Unchanged shapes. Every person `name` is the shown name. |

`POST /trips` validation (all errors at once; `i` is the 0-based position in `people`; text is trimmed first; an email
that is empty or only spaces counts as no email):

| Field | Code | Message |
|---|---|---|
| `name` | `required` | Enter a name for the trip. |
| `name` | `too_long` (> 80 characters) | Use at most 80 characters. |
| `start_date` | `invalid_date` (missing, not `YYYY-MM-DD`, or not a real date) | Enter a date as YYYY-MM-DD. |
| `end_date` | `invalid_date` | Enter a date as YYYY-MM-DD. |
| `end_date` | `before_start` (only when both dates are valid) | The end date is before the start. |
| `people` | `too_few` (no other person; also a missing or non-list `people`) | Add at least one more person. |
| `people` | `too_many` (more than 19 others, i.e. more than 20 including the creator) | A trip can have at most 20 people. |
| `people.{i}.name` | `required` | Enter a name. |
| `people.{i}.name` | `too_long` (> 60 characters) | Use at most 60 characters. |
| `people.{i}.name` | `duplicate` (same as the creator's display name or an earlier entry, ignoring case; accents count) | This name is already on the trip. |
| `people.{i}.email` | `invalid_email` (not `x@y.z`, same rule as sign-up) | Enter an email like ana@example.com. |
| `people.{i}.email` | `duplicate_email` (same as the creator's email or an earlier entry, after trim + lowercase) | This email is already on the trip. |

Only the later of two duplicates gets the error. Nothing is written when there is any error. The response never shows
whether an email belongs to an account.

Auth errors, as in epic 2: no or invalid token → `401 unauthenticated` on `POST /trips` and `PATCH /me`.

## Seed data

Trips 1–7 and the nine epic 2 accounts keep their ids and contents, so every epic 1 and epic 2 check still holds. New,
created after them, with the deterministic seed rules (no `time()`, `rand` or `date()` in `Seeder.php`):

- **Account Pia**, `pia@example.com`, password `travel-demo-2026`, display name "Pia". Like every seeded account, it has
  `last_login_at` NULL.
- **Trip 8 "Ski week"**, 2026-12-19 – 2026-12-26, people in this order:
  - Pia, linked to Pia's account;
  - "Inés", no account, with a pending invite `ines@example.com`;
  - "Grandpa", name only.

| Date | Expense | Amount | Recorded by | Paid by | Split |
|---|---|---|---|---|---|
| 2026-12-19 | Ski passes | `300,00 €` | Pia | Pia | equally, Pia, Inés and Grandpa |

Summary: total `300,00 €`, 1 expense, 3 people. Balances: Pia `+200,00 €`, Inés `−100,00 €`, Grandpa `−100,00 €`.
Transfers: **Inés pays Pia `100,00 €`**, **Grandpa pays Pia `100,00 €`**. Pia's "My trips": "Ski week" `300,00 €` only.

**Trip created in checks 2–4** (not seeded, it is trip 9 on a fresh seed): "Summer in Sicily", 2026-07-10 –
2026-07-17, with Ana (creator), Ben (`ben@example.com`, linked at once) and Grandma (name only). It starts with total
`0,00 €` and every balance `0,00 €`. After "Dinner" `10,00 €` paid by Ana, split equally between all three, the total
is `10,00 €`. Shares are Ana `3,34 €`, Ben `3,33 €` and Grandma `3,33 €` (Ana has the lowest person id and gets the
leftover cent). Balances are Ana `+6,66 €`, Ben `−3,33 €`, Grandma `−3,33 €`. Transfers: **Ben pays Ana `3,33 €`**,
**Grandma pays Ana `3,33 €`**.

Lisbon & Porto (trip 1) stays at `1.915,57 €` with "Ana pays Ben `63,75 €`", "David pays Ben `27,65 €`" and "David pays
Chloé `27,07 €`".

These figures were calculated with the current API code (`ExpenseService`, `SummaryService`) on a fresh in-memory
database after the existing seed.

## Tests

- **PHP (`packages/api/tests`, run through `tests/functional`):**
  - create trip: success returns `201` with the creator first and linked, the members in the order sent, `total_cents`
    0 and an all-zero summary. The trip appears in the creator's `GET /trips`.
  - validation, one test per row of the validation table. All errors come back at once. Duplicate names ignore case
    but not accents (`ben`/`Ben` duplicate, `Chloé`/`Chloe` allowed). The creator's name and email count as taken. An
    empty email is no email. 80 characters / 20 people pass, 81 / 21 fail. Nothing is written on `422`.
  - linking at creation: an email of an existing account (also `  BEN@Example.com `) sets `user_id`, writes no invite,
    and the trip is in that user's `GET /trips`. An email without an account writes an invite, and the trip is in nobody
    else's list.
  - linking at sign-up: signing up as `ines@example.com` links Inés on trip 8, deletes the invite, and lists trip 8 in
    the new user's `GET /trips`. The members of trip 8 then show the new display name.
  - expenses for name-only members: on a created trip, an expense paid by and split with a name-only member is saved,
    and the figures match the seed section (`1000` → `334/333/333`, two transfers of `333`).
  - display name: `PATCH /me` changes the name shown in members, balances, transfers and `recorded_by` on every trip,
    and validates `required` / `too_long`. Login and sign-up set `last_login_at`.
  - auth: `POST /trips` and `PATCH /me` without a token → `401`.
  - seed: deterministic. Includes Pia, trip 8, the invite and the figures above. Existing tests that use `user.name`
    or sign up with `name` are updated to `display_name`.
- **TypeScript (`tests/unit`):** the new-trip input helper (trims names and emails, empty email → `null`, keeps the
  order, never includes the creator). `updateMe` / `createTrip` send the right method, path and body (fake `fetch`).
- **Playwright (`tests/e2e`, 390x844):** a new `create-trip.test.ts` with one screenshot per 📸 check below. Each e2e
  file starts on a fresh seed, because checks 2–9 and 12 change Ana's and Ben's data. The epic 2 suite expects the
  new empty-state text in its check 11.

## Acceptance checks

Viewport 390x844. Freshly seeded database (`docker compose down -v && docker compose up`). App at
http://localhost:8081. Every demo password is `travel-demo-2026`. Run the checks in order: checks 2–4 create the trip
that checks 5 and 6 use, and check 12 renames Ana.

1. 📸 **My trips has "+ New trip".** Log in as `ana@example.com`. "My trips" shows the header "My trips" with "Your
   name" and "Log out", the cards "Madrid weekend" `78,30 €` and "Lisbon & Porto" `1.915,57 €`, and a full-width 56 px
   "+ New trip" button fixed at the bottom of the screen.
2. 📸 **New trip form.** Tap "+ New trip". The screen shows "‹ My trips", "New trip", an empty "Trip name", start and
   end dates prefilled with today's date as `YYYY-MM-DD`, the fixed row "Ana (you)" without "Remove", one empty person
   card with "Name", "Email (optional)" and "Remove", "+ Add person", and "Create trip" at the bottom.
3. 📸 **Create a trip with three people.** Enter "Summer in Sicily", start `2026-07-10`, end `2026-07-17`. In the first
   card enter "Ben" and `  BEN@Example.com `. Tap "+ Add person" and enter "Grandma" with no email. Tap "Create trip".
   The trip view opens with "‹ My trips" and "Summer in Sicily", the total `0,00 €`, "10 Jul 2026 – 17 Jul 2026 ·
   0 expenses", "3 people" and "No expenses yet. Tap + Add expense to record the first one." (no "Who owes whom", as in
   epic 1). The URL is `/?trip=9`. The Balances tab shows every balance `0,00 €` and "Everyone is settled up."
4. **First expense, uneven split, name-only member.** In "Summer in Sicily" tap "+ Add expense". The chips under "Paid
   by" and "Split between" are Ana, Ben and Grandma. Enter "Dinner", date `2026-07-10`, amount `10,00`, paid by Ana,
   split equally between all three, and save. The trip view shows total `10,00 €`, "1 expense", "Ben pays Ana
   `3,33 €`" and "Grandma pays Ana `3,33 €`". Balances shows Ana `+6,66 €`, Ben `−3,33 €`, Grandma `−3,33 €`. Tap "‹ My
   trips": three cards in this order: "Madrid weekend" `78,30 €`, "Summer in Sicily" `10,00 €`, "Lisbon & Porto"
   `1.915,57 €`.
5. **Linked member sees the trip.** Log out and log in as `ben@example.com`. "My trips" shows "Summer in Sicily"
   `10,00 €` above "Lisbon & Porto" `1.915,57 €`. Opening it shows "Ben pays Ana `3,33 €`".
6. **Not linked without the email.** Log in as `chloe@example.com`. "Summer in Sicily" is not listed. Opening
   `/?trip=9` shows "You are not a member of this trip."
7. 📸 **Validation errors.** Log in as Ana and tap "+ New trip". Leave the trip name empty, set start `2026-07-17` and
   end `2026-07-10`. In the first card enter "ana" with email `ana@example.com`. Add a card "Ben" with email `ben@x`.
   Add a card "ben". Tap "Create trip". Under the trip name: "Enter a name for the trip." Under End date: "The end date
   is before the start." Under the first card's name: "This name is already on the trip." Under its email: "This email
   is already on the trip." Under the second card's email: "Enter an email like ana@example.com." Under the third
   card's name: "This name is already on the trip." Above the button: "Please fix the fields marked in red." Tap "‹ My
   trips": still three trips, nothing was saved.
8. **At least one more person.** On "New trip" enter "Solo", keep the dates, remove the only person card and tap "Create
   trip". Under "People": "Add at least one more person." Nothing is saved.
9. **Limits.** On "New trip", tap "+ Add person" until there are 19 cards (20 people with Ana): "+ Add person" is gone.
   An 81-character trip name shows "Use at most 80 characters." An 80-character name with valid people is saved. The
   name wraps to at most 2 lines with "…" on "My trips", and shows on 1 line with "…" in the trip header, and nothing
   scrolls sideways.
10. 📸 **Pending invite linked at sign-up.** Log out, tap "No account yet? Sign up", and sign up as "Inés García",
    `ines@example.com`, `long-enough-1`. "My trips" opens with "Logged in as Inés García" and the card "Ski week",
    "19 Dec 2026 – 26 Dec 2026", `300,00 €`. Opening it shows "Inés García pays Pia `100,00 €`" and "Grandpa pays Pia
    `100,00 €`".
11. **Empty list text.** Sign up as `zoe@example.com` (any name, `long-enough-1`). The card reads "You are not on any trip
    yet. Start one with "+ New trip", or ask a friend to add you with your email." "+ New trip" is at the bottom.
12. 📸 **Your name.** Log in as Ana, tap "Your name". The field shows "Ana". Clear it and tap "Save": "Enter your name."
    under the field. Enter "Ana María" and tap "Save": "My trips" shows "Logged in as Ana María". Open "Lisbon & Porto":
    "Ana María pays Ben `63,75 €`", and the expense "Airport taxi to Alfama" reads "Recorded by Ana María". Log in as Ben
    and open "Summer in Sicily": "Ben pays Ana María `3,33 €`".
13. 📸 **API unreachable.** With the API stopped (`docker compose stop api`, or the e2e suite blocking it), on "New trip"
    with a filled-in form tap "Create trip": the owesSoft card "Could not reach the API at http://localhost:8080." shows
    above the button, the input stays, and "Create trip" can be tapped again. The same happens on "Your name" with
    "Save". After `docker compose start api`, tapping "Create trip" saves the trip.
14. **Token required.** In the console, `POST /trips` and `PATCH /me` without `Authorization` answer `401` with code
    `unauthenticated`.
15. **Earlier epics still hold.** With a fresh seed, the epic 1 and epic 2 checks show the same figures as before. The
    exception is the new empty-state text in epic 2 check 11 (this spec's check 11).

## Out of scope

From the roadmap: editing or deleting a trip, adding or removing people after creation, invitations or mail of any kind,
merging a name-only member with an account by hand. Excluded in the rounds: a separate username (the email stays the
login, Round 2 Q1), a date picker (Round 1 Q7), a confirmation before leaving an unsaved form (Round 3 Q3), showing
whether an email has an account (Round 1 Q8), showing emails to other members, checking duplicate names after a rename
or a later sign-up (Round 2 Q5), linking at first login instead of sign-up, showing `last_login_at`, changing your email
or password, and marking trips as paid (epic 4).

## Check on iOS and Android

- The "Create trip" and "Save" buttons stay reachable with the keyboard open: the form scrolls, and the keyboard does
  not cover the focused field, including the last person card's email.
- Name fields capitalise words. Email fields show the email keyboard with no auto-capital and no autocorrect. Date
  fields show a keyboard that can type `-`.
- Today's date in the date fields comes from the device's local date, so it is not a day off near midnight.
- "Remove", "+ Add person", "Your name" and "Log out" respond across their full 48 px height. With the largest
  accessibility text size, "My trips", "Your name" and "Log out" still fit in the header without overlapping.
- The fixed "+ New trip" and "Create trip" buttons do not sit under the home indicator or Android navigation bar.
- Both platforms still build: Expo export for `ios` and `android` succeeds in the container.
