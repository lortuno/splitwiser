# Epic 3: Create a group — specification

Source: `specs/roadmap.md`, epic 3. Brainstorming: `specs/groups/03-create-a-group-brainstorming.md` (rounds 1–5).
Boundaries: `specs/guidelines/architecture.md`, `specs/guidelines/ui.md`.

## Estimate

Development hours only, as defined in "Estimates" in AGENTS.md. Rows are append-only.

| Date | Task | Estimate (h) | Actual (h) |
|---|---|---|---|
| 2026-10-28 | Build the epic | 1.5 | 0.25 |
| 2026-10-29 | Build spec change: a trip becomes a group | 1 | 0.5 |

## Goal

Anyone logged in can start a group: a name, optional start and end dates, and the people who share the expenses. A
group can be a trip, a collection for gifts or any other shared expenses; every group works the same way, with no
kind of group. The creator is added
automatically and linked to their account. Everyone else is a name, with an optional email. If that email belongs to
an account, now or at a later sign-up, the person is linked to it and the group shows up in that person's "My groups".
`people.user_id` is a nullable foreign key to `users`, and `people` never holds an email. A pending email lives in
`group_invites` until it is linked. The database says "group" everywhere (`groups`, `group_members`, `group_invites`,
`group_status_changes`, `group_id`); the API paths, JSON fields, the `?trip=` link and the code names keep "trip", and
an existing database is renamed in place at its next start. Accounts get an editable **display name**, the only name the app shows for a
linked person, and a `last_login_at`. Saving a new group opens its empty group view (`0,00 €`, everyone settled), and
expenses can be recorded at once, including for name-only members. No new package, service or dependency.

## Screens

All buttons are at least `size.tapMin` (48 px) high. Primary buttons are `size.tapPrimary` (56 px) high and sit at the
bottom. The group view, Balances, the add expense form, Login and Sign-up keep their layout. Wherever they show a
person, they show the name from the API (the display name for linked people, Round 2 Q3). The sign-up field "Your
name" sets the display name.

### My groups (`MyTripsScreen`, changed)

```
┌──────────────────────────────────────┐
│                        [English  ▾] │  app bar (epic 6): its menu
├──────────────────────────────────────┤  holds "Settings" and "Log out"
│ My groups                            │  header: title 20 bold
│ Logged in as Ana                     │  caption, inkMuted (display name)
│ ┌────────────────┐┌────────────────┐ │  "I owe" / "I'm owed" summary
│ │ I owe          ││ I'm owed       │ │  (spec 02)
│ │       72,90 €  ││       20,00 €  │ │
│ └────────────────┘└────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Madrid weekend                   │ │  groups with dates first,
│ │ 12 Sep 2026 – 14 Sep 2026        │ │  newest start date first
│ │ Total                    78,30 € │ │
│ │ You owe                   9,15 € │ │  position line (spec 02)
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Lisbon & Porto                   │ │
│ │ 1 Jun 2026 – 7 Jun 2026          │ │
│ │ Total                 1.915,57 € │ │
│ │ You owe                  63,75 € │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Gifts for Ben                    │ │  then groups without dates,
│ │ Total                    40,00 € │ │  newest first; no date line
│ │ You're owed              20,00 € │ │
│ └──────────────────────────────────┘ │  (no group paid: no "Paid
│                                      │  groups" row, see spec 02)
│            (list scrolls)            │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │           + New group            │ │  primary, accent, 56 high,
│ └──────────────────────────────────┘ │  fixed at the bottom
└──────────────────────────────────────┘
```

- **Settings** and **Log out**: rows of the menu in the app bar (`specs/translations/06-translations-specification.md`).
  "Settings" opens the screen where the display name is changed.
- **+ New group** (`size.tapPrimary`, fixed at the bottom, outside the scrolling list): opens "New group". It shows in
  the empty, loaded and long-list states. It is hidden while the list is loading and in the error state.
- **Empty state (changed text):** a card "You are not on any group yet. Start one with "+ New group", or ask a friend to
  add you with your email."
- **Loading / error:** unchanged from epic 2 (centred spinner "Loading…"; "Could not reach the API at {url}." with
  "Try again").
- **Group cards:** the name wraps to at most 2 lines and ends in "…". A group without dates has no date line.
- **Order:** groups with dates by newest start date first, then groups without dates, newest created first (highest
  id first). The API sorts; the app shows the list as it comes. Paid groups go into the closed "Paid groups" section
  below, in the same order.
- **Summary, position lines, filters and "Paid groups":** specified in
  `specs/accounts/02-login-and-my-groups-specification.md`.

### New group (`NewTripScreen`, new)

```
┌──────────────────────────────────────┐
│                        [English  ▾] │  app bar
├──────────────────────────────────────┤
│ ‹ My groups                          │  back text button, 48 high
│ New group                            │  title 20 bold
├──────────────────────────────────────┤
│ Group name                           │  caption bold
│ ┌──────────────────────────────────┐ │
│ │ Summer in Sicily                 │ │  autoCapitalize words
│ └──────────────────────────────────┘ │
│ Dates (optional)                     │  caption, inkMuted
│ Start date          End date         │
│ ┌───────────────┐   ┌──────────────┐ │  two fields side by side,
│ │               │   │              │ │  empty, YYYY-MM-DD
│ └───────────────┘   └──────────────┘ │
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
│ │           Create group           │ │  primary, 56 high, fixed at
│ └──────────────────────────────────┘ │  the bottom
└──────────────────────────────────────┘
```

- **Opens with:** empty group name, both dates empty, the fixed row "{display name} (you)", and one empty person card.
- **‹ My groups** (`size.tapMin`): back to "My groups" at once. The input is dropped and nothing asks for confirmation.
- **Group name:** `autoCapitalize="words"`. **Dates** (optional, `newTrip.datesOptional` "Dates (optional)" above
  them): plain text fields, like the add expense date. Either both stay empty (a group without dates) or both are
  valid dates with the end not before the start. The app does not check them. The API does; an empty field is sent
  as `null`.
- **Person card:** "Name" (`autoCapitalize="words"`) and "Email (optional)" (`keyboardType="email-address"`, no
  autocapitalise, no autocorrect). **Remove** (`size.tapMin`) deletes that card. Every card can be removed, even the
  last one. The API then answers `too_few`.
- **+ Add person** (`size.tapMin`, `accentSoft` background): appends an empty card and focuses its name. It is hidden
  once there are 20 people including the creator (19 cards).
- **Create group** (`size.tapPrimary`, fixed at the bottom): sends `POST /trips` with the trimmed values the user typed.
  Empty email fields are sent as `null`. While the request runs the button reads "Creating group…" and is disabled.
  - `201` → the new group view opens on the Group tab, built from the response (`trip` + `summary`). On the web the URL
    becomes `?trip={id}`.
  - `422` → each message appears under its field (`FieldError`, red field border). `people` errors appear under the
    "People" label, and `people.{i}.*` errors appear under that card's field. Above the button, the owesSoft card reads
    "Please fix the fields marked in red." The input stays.
  - API unreachable → the owesSoft card above the button reads "Could not reach the API at {url}." The input stays and
    the button can be tapped again.
  - `401` → handled by the app shell (Login, "Your session has ended."), as in epic 2.
- **Loading / empty:** none. The form needs no data beyond the logged-in user, which the app already has.

### The display name in Settings (`SettingsScreen`, laid out in epic 6)

```
┌──────────────────────────────────────┐
│                        [English  ▾] │  app bar
├──────────────────────────────────────┤
│ ‹ My groups                          │  back text button, 48 high
│ Settings                             │  title 20 bold
├──────────────────────────────────────┤
│ This is how you appear on all your   │  body, inkMuted
│ groups.                              │
│                                      │
│ Name                                 │
│ ┌──────────────────────────────────┐ │  prefilled with the current
│ │ Ana                              │ │  display name
│ └──────────────────────────────────┘ │
│ Fill in this field.                  │  FieldError
│                                      │
│ Language  [English  ▾]               │  see epic 6
│                                      │
│            (flexible space)          │
│ ┌──────────────────────────────────┐ │
│ │               Save               │ │  primary, 56 high, bottom
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

- **‹ My groups:** back without saving.
- **Save** (`size.tapPrimary`, bottom): `PATCH /me { display_name }`. While the request runs it reads "Saving…" and is
  disabled. `200` → back to "My groups", which reloads and shows "Logged in as {new name}". `422` → the message under the
  field. API unreachable → the owesSoft card "Could not reach the API at {url}." above the button, and the input stays.
- **Loading / empty:** none. The field is prefilled from the user the app already has.

### Group view, Balances, Add expense (unchanged layout)

- After "Create group", the group view shows the group name in the header (1 line, "…"), `0,00 €`, "{start} – {end} ·
  0 expenses" ("0 expenses" alone for a group without dates), "{n} people" and "No expenses yet. Tap + Add expense to
  record the first one." As in epic 1 for a group without expenses, "Who owes whom" is not shown there; the Balances
  tab shows "Everyone is settled up."
- In a group without dates, a new expense's date starts as today's date (in a group with dates: today when it falls
  inside the group's dates, otherwise the nearest day of the group).
- Name-only members appear in "Paid by" and "Split between" exactly like linked members.

## Data

**Schema changes** (`packages/api/src/Database/Schema.php`):

- **Groups, not trips:** the tables are `groups (id, name, start_date TEXT NULL, end_date TEXT NULL)` with
  `CHECK ((start_date IS NULL) = (end_date IS NULL))`, `group_members (group_id, person_id)`, `group_invites`,
  `group_status_changes (group_id, …)`, and `expenses.group_id`; indexes are named after `group_id`. The views keep
  their names and the columns the API reads (`v_trip_totals`, `v_trip_status`, `trip_id` in their output), so the API
  code does not change; inside, they read the `group` tables.
- **Existing databases are renamed in place** by `bin/init-db.php` at the next start: when a `trips` table exists, it
  drops the views, renames each table and column (`ALTER TABLE … RENAME TO …`, `RENAME COLUMN trip_id TO group_id`),
  rebuilds `groups` once so the dates may be empty (copy into a new table, swap, keep every id), recreates the indexes
  and views, and logs "Renamed trips to groups." All in one transaction; on any error nothing changes and the start
  fails with the error. Every group, expense, account and session stays. A database without `trips` is left alone, so
  the log line appears once. A fresh database is created with the `group` tables.
- `users.name` → **`display_name TEXT NOT NULL`**. New **`last_login_at TEXT NULL`**: NULL for seeded accounts, set
  by the API at sign-up and at every login, never shown.
- `people`: unchanged. `name TEXT NOT NULL` keeps the name typed by the creator, and `user_id INTEGER NULL REFERENCES
  users (id)` links an account. `people` has no email column.
- Table **`group_invites`**: `person_id INTEGER PRIMARY KEY REFERENCES people (id) ON DELETE CASCADE`, `email TEXT
  NOT NULL` (trimmed, lowercased), index on `email`. A row exists only while the email has no account.
- **Shown name** = `COALESCE(users.display_name, people.name)`. It is used in `TripRepository::findMembers`,
  `v_member_balances.name`, `v_expense_list` (`recorded_by_name`, `paid_by_json`, `split_between_json`) and the
  transfers built from the balances. A rename therefore shows at once on every group, past expenses included.
**Writes:**
- `POST /trips`, in one transaction: insert the group, with both dates or with both `NULL`. Insert the creator's person (`name` = their display name,
  `user_id` = the user) as the first member. For each other person, insert the person (typed name) and the member row.
  With an email that belongs to an account, set `user_id`. With an email that has no account, insert a `group_invites`
  row.
- `POST /auth/signup`, in its transaction: create the user and session, then for every `group_invites` row with the
  same email, set `people.user_id` to the new user and delete the invite.
- `POST /auth/login`: sets `last_login_at`. `PATCH /me`: updates `display_name`.

**Reads:** `GET /trips` lists the user's groups with dates by newest `start_date` first, then the groups without dates
by highest id first. Membership is a person on the group with `user_id` = the user. A pending invite does not make
anyone a member.

**App:** the `User` DTO becomes `{ id, display_name, email }`. New `src/api/trips.ts` `createTrip` and
`src/api/auth.ts` `updateMe`. A small pure helper (e.g. `src/trips/newTripInput.ts`) turns the form state into the
request body: names and emails trimmed, an empty email or date → `null`, the creator never included. The `Trip` DTO's
`start_date` and `end_date` are `string | null`; the app shows no date line when they are `null`. The app adds, subtracts
and divides no money (architecture rule 6).

## API

Errors keep the existing shapes: `{ error: { code, message } }`, and for validation `422 { errors: { field: { code,
message } } }`. All money is integer `_cents`. CORS `Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS`.

| Request | Response |
|---|---|
| `POST /trips` `{ name, start_date?, end_date?, people: [{ name, email? }] }` | `201 { trip: { id, name, start_date, end_date, total_cents: 0, members: [{ id, name }] }, summary }`. A missing, `null` or empty date is no date; the response then has `start_date: null, end_date: null`. `members` starts with the creator. `summary` has the shape of `GET /trips/{id}/summary` (`total_cents: 0`, `expense_count: 0`, every balance `0`, `transfers: []`). The creator is never in `people`. A `people` entry with the creator's email is a `duplicate_email`. |
| `PATCH /me` `{ display_name }` | `200 { id, display_name, email }`. `422` `display_name`: `required` ("Enter your name."), `too_long` ("Use at most 60 characters."), checked after trimming. Names may repeat (Round 2 Q5). |
| `GET /me` | `200 { id, display_name, email }` (was `name`). |
| `POST /auth/signup` `{ display_name, email, password }` | `201 { token, user: { id, display_name, email } }`. The field `name` becomes `display_name`, with the same rules and messages as before. Pending invites for the email are linked (see Data). |
| `POST /auth/login` | `200 { token, user: { id, display_name, email } }`. Sets `last_login_at`. |
| `GET /trips`, `GET /trips/{id}`, `/expenses`, `/summary` | Unchanged shapes; `start_date` and `end_date` are `null` for a group without dates. `GET /trips` uses the order in Data. Every person `name` is the shown name. |

`POST /trips` validation (all errors at once; `i` is the 0-based position in `people`; text is trimmed first; an email
that is empty or only spaces counts as no email):

| Field | Code | Message |
|---|---|---|
| `name` | `required` | Enter a name for the group. |
| `name` | `too_long` (> 80 characters) | Use at most 80 characters. |
| `start_date` | `invalid_date` (not `YYYY-MM-DD` or not a real date; or missing while `end_date` is given) | Enter a date as YYYY-MM-DD. |
| `end_date` | `invalid_date` (not `YYYY-MM-DD` or not a real date; or missing while `start_date` is given) | Enter a date as YYYY-MM-DD. |
| `end_date` | `before_start` (only when both dates are valid) | The end date is before the start. |
| `people` | `too_few` (no other person; also a missing or non-list `people`) | Add at least one more person. |
| `people` | `too_many` (more than 19 others, i.e. more than 20 including the creator) | A group can have at most 20 people. |
| `people.{i}.name` | `required` | Enter a name. |
| `people.{i}.name` | `too_long` (> 60 characters) | Use at most 60 characters. |
| `people.{i}.name` | `duplicate` (same as the creator's display name or an earlier entry, ignoring case; accents count) | This name is already on the group. |
| `people.{i}.email` | `invalid_email` (not `x@y.z`, same rule as sign-up) | Enter an email like ana@example.com. |
| `people.{i}.email` | `duplicate_email` (same as the creator's email or an earlier entry, after trim + lowercase) | This email is already on the group. |

Only the later of two duplicates gets the error. Nothing is written when there is any error. The response never shows
whether an email belongs to an account.

Auth errors, as in epic 2: no or invalid token → `401 unauthenticated` on `POST /trips` and `PATCH /me`.

## Seed data

Groups 1–7 and the nine epic 2 accounts keep their ids and contents, so every epic 1 and epic 2 check still holds. New,
created after them, with the deterministic seed rules (no `time()`, `rand` or `date()` in `Seeder.php`):

- **Account Pia**, `pia@example.com`, password `travel-demo-2026`, display name "Pia". Like every seeded account, it has
  `last_login_at` NULL.
- **Group 8 "Ski week"**, 2026-12-19 – 2026-12-26, people in this order:
  - Pia, linked to Pia's account;
  - "Inés", no account, with a pending invite `ines@example.com`;
  - "Grandpa", name only.

| Date | Expense | Amount | Recorded by | Paid by | Split |
|---|---|---|---|---|---|
| 2026-12-19 | Ski passes | `300,00 €` | Pia | Pia | equally, Pia, Inés and Grandpa |

Summary: total `300,00 €`, 1 expense, 3 people. Balances: Pia `+200,00 €`, Inés `−100,00 €`, Grandpa `−100,00 €`.
Transfers: **Inés pays Pia `100,00 €`**, **Grandpa pays Pia `100,00 €`**. Pia's "My groups": "Ski week" `300,00 €` only.

**Group created in checks 2–4** (not seeded, it is group 9 on a fresh seed): "Summer in Sicily", 2026-07-10 –
2026-07-17, with Ana (creator), Ben (`ben@example.com`, linked at once) and Grandma (name only). It starts with total
`0,00 €` and every balance `0,00 €`. After "Dinner" `10,00 €` paid by Ana, split equally between all three, the total
is `10,00 €`. Shares are Ana `3,34 €`, Ben `3,33 €` and Grandma `3,33 €` (Ana has the lowest person id and gets the
leftover cent). Balances are Ana `+6,66 €`, Ben `−3,33 €`, Grandma `−3,33 €`. Transfers: **Ben pays Ana `3,33 €`**,
**Grandma pays Ana `3,33 €`**.

Lisbon & Porto (group 1) stays at `1.915,57 €` with "Ana pays Ben `63,75 €`", "David pays Ben `27,65 €`" and "David pays
Chloé `27,07 €`".

These figures were calculated with the current API code (`ExpenseService`, `SummaryService`) on a fresh in-memory
database after the existing seed.

## Tests

- **PHP (`packages/api/tests`, run through `tests/functional`):**
  - create group: success returns `201` with the creator first and linked, the members in the order sent, `total_cents`
    0 and an all-zero summary. The group appears in the creator's `GET /trips`.
  - validation, one test per row of the validation table. All errors come back at once. Duplicate names ignore case
    but not accents (`ben`/`Ben` duplicate, `Chloé`/`Chloe` allowed). The creator's name and email count as taken. An
    empty email is no email. 80 characters / 20 people pass, 81 / 21 fail. Nothing is written on `422`.
  - linking at creation: an email of an existing account (also `  BEN@Example.com `) sets `user_id`, writes no invite,
    and the group is in that user's `GET /trips`. An email without an account writes an invite, and the group is in nobody
    else's list.
  - linking at sign-up: signing up as `ines@example.com` links Inés on group 8, deletes the invite, and lists group 8 in
    the new user's `GET /trips`. The members of group 8 then show the new display name.
  - expenses for name-only members: on a created group, an expense paid by and split with a name-only member is saved,
    and the figures match the seed section (`1000` → `334/333/333`, two transfers of `333`).
  - display name: `PATCH /me` changes the name shown in members, balances, transfers and `recorded_by` on every group,
    and validates `required` / `too_long`. Login and sign-up set `last_login_at`.
  - auth: `POST /trips` and `PATCH /me` without a token → `401`.
  - seed: deterministic. Includes Pia, group 8, the invite and the figures above. Existing tests that use `user.name`
    or sign up with `name` are updated to `display_name`.
  - groups without dates: created with both dates missing, `null` or empty; one date without the other is
    `invalid_date` on the missing one; `GET /trips` puts dated groups first (newest start first), then dateless ones
    (highest id first).
  - renaming in place: a database built with the `trips` schema and the seed is renamed by the start step: the
    `group` tables exist, no `trips` table is left, every id, expense, invite, status change and figure is the same,
    the log says "Renamed trips to groups." once, and a second start leaves it alone. A failure in the middle changes
    nothing.
- **TypeScript (`tests/unit`):** the new-group input helper (trims names and emails, empty email or date → `null`,
  keeps the order, never includes the creator). `updateMe` / `createTrip` send the right method, path and body (fake
  `fetch`). The date line of a card and of the group header is left out when the dates are `null`; a new expense's
  date in a group without dates is today.
- **Playwright (`tests/e2e`, 390x844):** a new `create-trip.test.ts` with one screenshot per 📸 check below. Each e2e
  file starts on a fresh seed, because checks 2–9 and 12 change Ana's and Ben's data. The epic 2 suite expects the
  new empty-state text in its check 11.

## Acceptance checks

Viewport 390x844. Freshly seeded database (`docker compose down -v && docker compose up`). App at
http://localhost:8081. Every demo password is `travel-demo-2026`. Run the checks in order: checks 2–4 create the group
that checks 5 and 6 use, and check 12 renames Ana.

1. 📸 **My groups has "+ New group".** Log in as `ana@example.com`. "My groups" shows the header "My groups", the menu in
   the app bar lists "Settings" and "Log out", the cards "Madrid weekend" `78,30 €` and "Lisbon & Porto" `1.915,57 €`, and a full-width 56 px
   "+ New group" button fixed at the bottom of the screen.
2. 📸 **New group form.** Tap "+ New group". The screen shows "‹ My groups", "New group", an empty "Group name", "Dates
   (optional)" with empty start and end dates, the fixed row "Ana (you)" without "Remove", one empty person
   card with "Name", "Email (optional)" and "Remove", "+ Add person", and "Create group" at the bottom.
3. 📸 **Create a group with three people.** Enter "Summer in Sicily", start `2026-07-10`, end `2026-07-17`. In the first
   card enter "Ben" and `  BEN@Example.com `. Tap "+ Add person" and enter "Grandma" with no email. Tap "Create group".
   The group view opens with "‹ My groups" and "Summer in Sicily", the total `0,00 €`, "10 Jul 2026 – 17 Jul 2026 ·
   0 expenses", "3 people" and "No expenses yet. Tap + Add expense to record the first one." (no "Who owes whom", as in
   epic 1). The URL is `/?trip=9`. The Balances tab shows every balance `0,00 €` and "Everyone is settled up."
4. **First expense, uneven split, name-only member.** In "Summer in Sicily" tap "+ Add expense". The chips under "Paid
   by" and "Split between" are Ana, Ben and Grandma. Enter "Dinner", date `2026-07-10`, amount `10,00`, paid by Ana,
   split equally between all three, and save. The group view shows total `10,00 €`, "1 expense", "Ben pays Ana
   `3,33 €`" and "Grandma pays Ana `3,33 €`". Balances shows Ana `+6,66 €`, Ben `−3,33 €`, Grandma `−3,33 €`. Tap "‹ My
   groups": three cards in this order: "Madrid weekend" `78,30 €`, "Summer in Sicily" `10,00 €`, "Lisbon & Porto"
   `1.915,57 €`.
5. **Linked member sees the group.** Log out and log in as `ben@example.com`. "My groups" shows "Summer in Sicily"
   `10,00 €` above "Lisbon & Porto" `1.915,57 €`. Opening it shows "Ben pays Ana `3,33 €`".
6. **Not linked without the email.** Log in as `chloe@example.com`. "Summer in Sicily" is not listed. Opening
   `/?trip=9` shows "You are not a member of this group."
7. 📸 **Validation errors.** Log in as Ana and tap "+ New group". Leave the group name empty, set start `2026-07-17` and
   end `2026-07-10`. In the first card enter "ana" with email `ana@example.com`. Add a card "Ben" with email `ben@x`.
   Add a card "ben". Tap "Create group". Under the group name: "Enter a name for the group." Under End date: "The end date
   is before the start." Under the first card's name: "This name is already on the group." Under its email: "This email
   is already on the group." Under the second card's email: "Enter an email like ana@example.com." Under the third
   card's name: "This name is already on the group." Above the button: "Please fix the fields marked in red." Tap "‹ My
   groups": still three groups, nothing was saved.
8. **At least one more person.** On "New group" enter "Solo", leave the dates empty, remove the only person card and tap "Create
   group". Under "People": "Add at least one more person." Nothing is saved.
9. **Limits.** On "New group", tap "+ Add person" until there are 19 cards (20 people with Ana): "+ Add person" is gone.
   An 81-character group name shows "Use at most 80 characters." An 80-character name with valid people and no dates
   is saved (group 10). The
   name wraps to at most 2 lines with "…" on "My groups", and shows on 1 line with "…" in the group header, and nothing
   scrolls sideways.
10. 📸 **Pending invite linked at sign-up.** Log out, tap "No account yet? Sign up", and sign up as "Inés García",
    `ines@example.com`, `long-enough-1`. "My groups" opens with "Logged in as Inés García" and the card "Ski week",
    "19 Dec 2026 – 26 Dec 2026", `300,00 €`. Opening it shows "Inés García pays Pia `100,00 €`" and "Grandpa pays Pia
    `100,00 €`".
11. **Empty list text.** Sign up as `zoe@example.com` (any name, `long-enough-1`). The card reads "You are not on any group
    yet. Start one with "+ New group", or ask a friend to add you with your email." "+ New group" is at the bottom.
12. 📸 **The display name.** Log in as Ana and open "Settings" from the menu. The field shows "Ana". Clear it and tap
    "Save": "Fill in this field." under the field. Enter "Ana María" and tap "Save": "My groups" shows "Logged in as Ana María". Open "Lisbon & Porto":
    "Ana María pays Ben `63,75 €`", and the expense "Airport taxi to Alfama" reads "Recorded by Ana María". Log in as Ben
    and open "Summer in Sicily": "Ben pays Ana María `3,33 €`".
13. 📸 **API unreachable.** With the API stopped (`docker compose stop api`, or the e2e suite blocking it), on "New group"
    with a filled-in form tap "Create group": the owesSoft card "Could not reach the API at http://localhost:8080." shows
    above the button, the input stays, and "Create group" can be tapped again. The same happens on "Settings" with
    "Save". After `docker compose start api`, tapping "Create group" saves the group.
14. **Token required.** In the console, `POST /trips` and `PATCH /me` without `Authorization` answer `401` with code
    `unauthenticated`.
15. **Earlier epics still hold.** With a fresh seed, the epic 1 and epic 2 checks show the same figures as before. The
    exception is the new empty-state text in epic 2 check 11 (this spec's check 11).
16. 📸 **A group without dates.** Log in as Ana and tap "+ New group". Enter "Gifts for Ben", leave both dates empty,
    add "Chloé" with `chloe@example.com`, and tap "Create group". The group view shows "Gifts for Ben", `0,00 €`,
    "0 expenses" with no dates before it, and "2 people"; the URL is `/?trip=11`. Tap "+ Add expense": the date field
    shows today's date. Enter "Book", `40,00`, paid by Ana María, split equally between both, and save: total
    `40,00 €`, "Chloé pays Ana María `20,00 €`". Tap "‹ My groups": the cards are "Madrid weekend", "Summer in Sicily",
    "Lisbon & Porto", then "Gifts for Ben" `40,00 €` and the 80-character group from check 9, both without a date
    line.
17. **One date without the other.** On "New group" enter "Half dates", start `2026-08-01`, leave the end empty, add
    "Zed", and tap "Create group": "Enter a date as YYYY-MM-DD." under End date, and nothing is saved. Move the date to
    End date and empty Start date: the same text under Start date.
18. **API.** In the console with Ana's token: `POST /trips` with `start_date: null, end_date: null` (and again with
    both left out) answers `201` with `start_date: null, end_date: null`; with only `start_date` it answers `422` with
    `errors.end_date.code` `invalid_date`. `GET /trips` lists Ana's groups in the order of check 16.
19. **An existing database is renamed in place.** With a database from before this change (tables `trips`,
    `trip_members`, …, for example the one in `packages/api/var` with the admin's group "Team lunch"), restart the API's
    start step (`init-db`): its log says "Renamed trips to groups." Every group, expense and account is still there:
    the admin logs in with the same password and sees the same groups and totals. The database has the tables
    `groups`, `group_members`, `group_invites` and `group_status_changes` and no `trips` table. A second restart does
    not print the line again.

## Out of scope

From the roadmap: editing or deleting a group, adding or removing people after creation, invitations or mail of any kind,
merging a name-only member with an account by hand. Excluded in the rounds: a separate username (the email stays the
login, Round 2 Q1), a date picker (Round 1 Q7), a confirmation before leaving an unsaved form (Round 3 Q3), showing
whether an email has an account (Round 1 Q8), showing emails to other members, checking duplicate names after a rename
or a later sign-up (Round 2 Q5), linking at first login instead of sign-up, showing `last_login_at`, changing your email
or password, and marking groups as paid (epic 4). Excluded in round 5: a kind of group (trip, gifts, other),
renaming the API paths, JSON fields, the `?trip=` link and the code names, deleting the database instead of renaming
it, a seeded group without dates, and renaming the app ("Travel expenses").

## Check on iOS and Android

- The "Create group" and "Save" buttons stay reachable with the keyboard open: the form scrolls, and the keyboard does
  not cover the focused field, including the last person card's email.
- Name fields capitalise words. Email fields show the email keyboard with no auto-capital and no autocorrect. Date
  fields show a keyboard that can type `-`.
- In a group without dates, a new expense's date is the device's local date, so it is not a day off near midnight.
- "Remove", "+ Add person" and the menu's "Settings" and "Log out" rows respond across their full 48 px height. With
  the largest accessibility text size, "My groups" still fits in the header.
- The fixed "+ New group" and "Create group" buttons do not sit under the home indicator or Android navigation bar.
- Both platforms still build: Expo export for `ios` and `android` succeeds in the container.
