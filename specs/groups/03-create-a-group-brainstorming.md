# Epic 3: Create a trip — brainstorming

Source: `specs/roadmap.md`, epic 3. Boundaries: `specs/guidelines/architecture.md`, `specs/guidelines/ui.md`.
Append-only: questions and answers are never changed once written. Answer by moving the `[x]` or adding a note under
the question.

## What exists today (for reference)

- **Accounts (epic 2):** `users` (name, email trimmed and lowercased, unique, password hash) and `sessions`. `people`
  has a nullable `user_id`. A user is a member of a trip when one of the trip's `trip_members` people has that
  `user_id`. `people` has **no email column** yet, so a name-only member cannot be linked later.
- **API:** `GET /health`, `POST /auth/signup|login|logout`, `GET /me`, `GET /trips` (only my trips, newest start date
  first, with `total_cents`), `GET /trips/{id}`, `GET|POST /trips/{id}/expenses`, `GET /trips/{id}/summary`. There is
  **no endpoint that creates a trip**. `TripRepository::create` and `addMember` and `PersonRepository::create(name,
  userId)` exist, but only the seed uses them.
- **Validation style:** `422 { errors: { field: { code, message } } }`, as in `ExpenseValidator` and
  `AuthService::signUp` (name 1–60 characters, email `x@y.z`). Dates are `YYYY-MM-DD` text, checked with `checkdate`,
  and the add expense form uses a plain text field for the date (no date picker dependency).
- **App:** `App.tsx` routes between Login, Sign-up, "My trips" and the trip view with `useState` only. "My trips" has
  no "New trip" action, and its empty state says "When someone adds you to a trip with your email, it shows up here."
  The trip view with no expenses already shows `0,00 €` and "all settled" (epic 1, trip 2 "Empty weekend").
- **Seed:** 9 demo accounts (Ana, Ben, Chloé, David, Eva, Hugo, Jon, Noah, Olga, password `travel-demo-2026`) and
  trips 1–7. Signing up as `zoe@example.com` gives an empty "My trips".

---

## Round 1

Functionality and the rules behind it.

### Q1. How is a member's optional email stored and linked?
- [x] `people` gets a nullable `email` column (trimmed, lowercased). On create, a member whose email belongs to an account gets `user_id` set at once. On sign-up, every person row with that email and no `user_id` gets linked to the new account. No new table. (Recommended)
- [ ] A separate `trip_invites` table (trip, person, email), deleted once the email is linked.
- [ ] Store only `user_id`: an email is accepted only if an account already exists (no linking at a later sign-up).

### Q2. The creator on the trip
The roadmap says the logged-in user is added automatically.
- [x] The creator is the first member, linked to their account, with their account name and email. In the form they appear as a fixed row "Ana (you)" that cannot be removed or renamed. (Recommended)
- [ ] As above, but the creator can change the name shown on this trip (e.g. "Mum" instead of "Ana").

### Q3. Which name does a linked member show on the trip?
- [x] The name the creator typed. The account name is not used, so "Grandma" stays "Grandma" after she signs up as "Rosa Pérez". (Recommended)
- [ ] The account name replaces the typed name as soon as the member is linked.

### Q4. What counts as a duplicate name in one trip?
The roadmap rules out duplicate names. The creator's name counts too.
- [x] Compared after trimming and ignoring upper and lower case: "ben", "Ben " and "BEN" are the same. Accents count, so "Chloé" and "Chloe" are different. (Recommended)
- [ ] Exact match only after trimming: "Ben" and "ben" are allowed together.

### Q5. Emails within one trip
- [x] The same email may appear only once per trip, and never the creator's own email, so one account is at most one person per trip (as epic 2 assumes). Error under the member's email: "This email is already on the trip." (Recommended)
- [ ] Allow duplicates; only the first matching person gets linked.

### Q6. How many people, and how long can names be?
- [x] Trip name 1–80 characters, each person's name 1–60 characters (like the account name), after trimming. At least 2 people including the creator, at most 20. (Recommended)
- [ ] As above, but a trip with only the creator is allowed (expenses for yourself).
- [ ] No upper limit on the number of people.

### Q7. Trip dates
- [x] Start and end are required, `YYYY-MM-DD`, typed in plain text fields like the add expense date, both prefilled with today's date. End may equal start, not be before it. Past and future dates are both allowed. (Recommended)
- [ ] As above, but the fields start empty.
- [ ] Add a date picker (new dependency, inventory entry).

### Q8. Does the form reveal whether an email already has an account?
- [x] No. The email is accepted either way and nothing tells the creator whether it matched an account. After saving, the trip looks the same. (Recommended: does not leak who has an account.)
- [ ] Yes: after saving, a linked member shows a small "has an account" label in the trip view.

- [x] Round 1 answered (tick this when you have answered every question above)

## Round 2

Follow-up on the notes given in the chat after round 1 (they change Round 1 Q1 and Q3), in the user's words:

> Q1: people can have user_id nullable but it is a foreign key to users, not the raw email. There is a user table, with
> username and email and display name and last login, etc. And we link to that table in the trip to display the people,
> but it can be nullable, so only the creator of a trip is mandatory, the rest can be just names.
> Q3: Username is custom by the users, we do not display email. Display name is editable and it is the field used for
> frontend.

### Q1. Which fields does `users` get, and how do you log in?
Today `users` has `name`, `email` (unique, the login), `password_hash` and `created_at`.
- [x] Rename `name` to `display_name` (shown everywhere in the app, set at sign-up, editable later) and add `last_login_at` (written at every login, never shown). The email stays the login and is never shown to other members. No separate username. (Recommended)
- [ ] As above, plus a unique `username` chosen at sign-up. Login still uses the email; the username is not shown.
- [ ] As above, plus a unique `username`, and login uses the username instead of the email.

### Q2. How does a member other than the creator get linked to an account?
`people.user_id` stays a nullable foreign key to `users`, and `people` holds no email.
- [x] Optional email in the form, kept in a separate table `trip_invites` (person id, email). If an account with that email exists, `people.user_id` is set at once. If not, the first sign-up with that email sets it. Either way the invite row is then deleted. Keeps the roadmap's "now or at a later sign-up". (Recommended)
- [ ] No linking in this epic: everyone except the creator is a name only, and the trip shows up only in the creator's list. The roadmap's email linking moves to "Out of scope".
- [ ] Only accounts that already exist can be linked (email typed in the form, nothing stored when there is no match). No linking at a later sign-up.

### Q3. Which name does a person show on a trip?
- [x] A linked person shows the account's `display_name` everywhere (trip view, balances, transfers, the add expense chips, "Recorded by"), and a rename shows at once on every trip, past expenses included. A name-only person shows the name the creator typed. (Recommended)
- [ ] As above, but the typed name is shown until the person opens the trip once.

### Q4. Who edits the display name, and where?
Changing your name was out of scope in epic 2.
- [x] Only the account owner. A new small "Your name" screen opens from a "Your name" text button in the "My trips" header (next to "Log out"), with one field (1–60 characters) and "Save" at the bottom. (Recommended)
- [ ] Set at sign-up only in this epic; editing moves to a later epic and to "Out of scope".

### Q5. What happens when a display name clashes with a name on a trip?
Round 1 Q4 rules out duplicate names (case-insensitive) when a trip is created. Later, a linked account can be
renamed, or can sign up with a name that is already on the trip.
- [x] The no-duplicates rule is only checked when the trip is created. After that, two people with the same name on a trip are allowed; the app shows them as they are. (Recommended: keeps renaming simple.)
- [ ] A rename that matches another person's name on any of your trips is rejected with "Someone on one of your trips already has this name."

### Q6. Do Round 1 Q5 and Q8 still hold?
They only apply if emails are typed in the form (Q2, first or third option).
- [x] Yes: an email at most once per trip and never the creator's own; and the form never reveals whether an email has an account. (Recommended)
- [ ] They no longer apply (Q2, second option).

- [x] Round 2 answered (tick this when you have answered every question above)

## Round 3

Screens. Correct any wireframe directly below it, or tick another option. All buttons are at least `size.tapMin`
(48 px) high, and primary buttons are `size.tapPrimary` (56 px) high and sit at the bottom. The trip view, Balances and
add expense screens do not change their layout (they only show display names, Round 2 Q3). Login and Sign-up keep
their layout; the sign-up field "Your name" becomes the display name.

### Q1. "My trips" (changed)

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
Empty state card (new account): "You are not on any trip yet. Start one with \"+ New trip\", or ask a friend to add you
with your email." The "+ New trip" button shows in the empty state too.
- [x] As drawn. (Recommended)
- [ ] As drawn, but "+ New trip" sits in the header instead of at the bottom.

### Q2. "New trip" form (new, `NewTripScreen`)

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
The form opens with one empty person card under "Ana (you)". Errors come from the API (`422`) and show under each
field, as in the add expense form. "Add at least one more person." shows under "People" when every other card is gone.
"+ Add person" disappears at 20 people.
- [x] As drawn. (Recommended)
- [ ] As drawn, but the email field is hidden behind an "Add email" text button on each card, to keep cards short.
- [ ] One line per person (name only), and an email can be added only after the trip is created.

### Q3. Leaving the "New trip" form with unsaved input
- [x] "‹ My trips" leaves at once and drops the input, without asking. (Recommended: no browser dialogs, and the form is short.)
- [ ] Ask "Discard this trip?" with "Discard" and "Keep editing" in an in-app card.

### Q4. After "Create trip"
- [x] While saving, the button reads "Creating trip…" and is disabled. `201` opens the new trip view on the Trip tab (`0,00 €`, "All settled", empty list, "+ Add expense"); on the web the URL becomes `?trip={id}`. "‹ My trips" from there shows the new trip in the list. (Recommended)
- [ ] `201` returns to "My trips" with the new trip at the top.

### Q5. "Your name" screen (new, `YourNameScreen`)

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
"Save" → "Saving…", disabled; `200` returns to "My trips", where "Logged in as {new name}" shows the change.
- [x] As drawn. (Recommended)
- [ ] As drawn, but stay on the screen after saving and show "Saved." under the field.

### Q6. Unreachable API in the new screens
- [x] "New trip" and "Your name" keep their input and show the owesSoft card "Could not reach the API at {url}." above the bottom button, like Login. The button can be tapped again. (Recommended)
- [ ] Replace the whole screen with the centred "Could not reach the API" state and "Try again".

- [x] Round 3 answered (tick this when you have answered every question above)

## Round 4

API, errors, edge cases and seed data. Exact euro amounts in the spec will come from running the real API code on a
fresh database.

### Q1. Data: how is the shown name worked out?
- [x] `users.name` becomes `display_name`, plus `last_login_at` (NULL until the first login; set at login and sign-up). `people.name` stays NOT NULL and keeps the typed name. Every read (`GET /trips/{id}` members, `v_member_balances`, `v_expense_list`) shows `COALESCE(users.display_name, people.name)`, so a rename shows everywhere at once. New table `trip_invites (person_id PRIMARY KEY REFERENCES people, email TEXT NOT NULL)`, index on `email`. Dev databases are reset once with `docker compose down -v`, as in epic 2. (Recommended)
- [ ] As above, but a rename also overwrites `people.name` of every person linked to the account (no join on read).

### Q2. Endpoints
```
POST  /trips  { name, start_date, end_date, people: [{ name, email? }] }
              → 201 { trip: { id, name, start_date, end_date, total_cents, members: [{ id, name }] }, summary }
                the creator is not sent: the API adds them as the first member, linked to the session's user
PATCH /me     { display_name }  → 200 { id, display_name, email }
GET   /me, POST /auth/signup, POST /auth/login → user is { id, display_name, email } (was { id, name, email });
              the sign-up request field becomes display_name
```
CORS `Access-Control-Allow-Methods` adds `PATCH`. Trips, members and invites are written in one transaction. The
response follows the existing rule "a write returns the updated summary" (`summary` of the new, empty trip).
- [x] As listed. (Recommended)
- [ ] As listed, but `POST /me` instead of `PATCH /me` (CORS stays `GET, POST, OPTIONS`), and the sign-up field stays `name`.

### Q3. Validation errors for `POST /trips`
`422 { errors: { field: { code, message } } }`; a person's fields are keyed by their position in `people` (0-based),
like `paid_by.{id}` in the expense form.
```
name                 required "Enter a name for the trip."   too_long "Use at most 80 characters."
start_date           invalid_date "Enter a date as YYYY-MM-DD."
end_date             invalid_date (same)                     before_start "The end date is before the start."
people               too_few "Add at least one more person." too_many "A trip can have at most 20 people."
people.{i}.name      required "Enter a name."  too_long "Use at most 60 characters."
                     duplicate "This name is already on the trip."   (also when it matches the creator's name)
people.{i}.email     invalid_email "Enter an email like ana@example.com."
                     duplicate_email "This email is already on the trip."  (also the creator's own email)
```
An empty email (or only spaces) means "no email". All errors are returned at once. Only the second of two duplicate
names gets the error.
- [x] As listed. (Recommended)
- [ ] As listed, but the first error stops validation (one error at a time).

### Q4. Linking at sign-up
- [x] In the sign-up transaction, every `trip_invites` row with the new (trimmed, lowercased) email sets `people.user_id` to the new account and is deleted. "My trips" right after sign-up already lists those trips. The person on the trip then shows the new account's display name (Round 2 Q3). (Recommended)
- [ ] Link at the first login instead of at sign-up.

### Q5. Seed data for the checks
The epic 2 checks rely on Ana, Ben and the others seeing exactly their current trips, and on `zoe@example.com` signing up
to an empty list, so the new data must not touch them.
- [x] A new account **Pia** (`pia@example.com`, `travel-demo-2026`) and trip 8 **"Ski week"** (2026-12-19 – 2026-12-26) created by Pia, with members Pia (linked), "Inés" (invite `ines@example.com`, no account yet) and "Grandpa" (name only). One expense: "Ski passes" `300,00 €` paid by Pia, split equally, so Inés and Grandpa each pay Pia `100,00 €`. Signing up as `ines@example.com` shows "Ski week" at once. (Recommended)
- [ ] No new seed data: the checks create every trip they need through the form.

### Q6. Edge cases as acceptance checks. Untick any you do not want.
- [x] Ana creates "Summer in Sicily" with Ben (`ben@example.com`) and "Grandma" (no email): the empty trip view shows `0,00 €`, "All settled", "3 people". 📸
- [x] In that trip, Ana adds "Dinner" `10,00 €` paid by Ana, split equally: total `10,00 €`, and Ben and Grandma pay Ana the amounts the API returns for an uneven split (`3,33 €` each, Ana keeps the extra cent). Expenses can be paid by or split with Grandma, who has no account.
- [x] Ben logs in and sees "Summer in Sicily" in his list, with `10,00 €`.
- [x] Sign up as `ines@example.com`: "Ski week" is in the list at once, and the trip view shows the new display name instead of "Inés".
- [x] Email typed as `  BEN@Example.com ` in the form still links Ben.
- [x] Validation: empty trip name, end before start, `ben` next to `Ben`, Ana's own name or email, an invalid email, and no other person each show their message under the right field; nothing is saved. 📸
- [x] An 80-character trip name is accepted and wraps on "My trips" and in the trip header ("…"); 81 characters is rejected.
- [x] 20 people is the maximum: "+ Add person" disappears, and the API rejects 21 with `too_many`.
- [x] "Your name": Ana renames herself to "Ana María"; "Logged in as Ana María", and "Lisbon & Porto" shows "Ana María pays Ben `63,75 €`". An empty name shows "Enter your name." 📸
- [x] API unreachable on "Create trip" and "Save": the card shows, the input stays.
- [x] `POST /trips` without a token → `401`; `PATCH /me` without a token → `401`.

No trip can be marked as paid yet (epic 4), so "a trip already marked as paid" does not apply here.

- [x] Round 4 answered (tick this when you have answered every question above)

## Decisions made while writing the specification

- Round 1 Q1 and Q3 are superseded by Round 2 Q2 and Q3: `people` has no email column, pending emails live in
  `trip_invites`, and a linked person shows the account's display name.
- The trip created in the checks, "Summer in Sicily", uses fixed dates 2026-07-10 – 2026-07-17 instead of today, so
  its place in Ana's list and its date line are deterministic. On a fresh seed it is trip 9. "Ski week" is trip 8.
- The creator's person row stores their display name at creation as `people.name`. It is only a fallback, because the
  shown name always comes from `users.display_name`.
- The sign-up Playwright check uses `ines@example.com` and the display name "Inés García", so the change from the typed
  "Inés" is visible. `zoe@example.com` stays free for the epic 2 empty-list check.
- A missing or non-list `people` answers `too_few`. `before_start` is only reported when both dates are valid.
- "Please fix the fields marked in red." (the add expense form's existing text) shows above "Create trip" on a `422`.
- Each e2e file starts on a fresh seed, because the epic 3 checks change Ana's and Ben's lists and Ana's name.
- Figures (`300,00 €` → two × `100,00 €`; `10,00 €` → `3,34 / 3,33 / 3,33`, two × `3,33 €`) come from the real API
  code on an in-memory database.

# Change: a trip becomes a group

The user's request: "rename trip to group, so a group can hold a trip, gifts or any other shared expenses; at table and
translation level". Agreed before this round: this is a change to this feature (03), every other spec only follows
in wording, checks and paths, and `specs/trips/` becomes `specs/groups/` (`01-group-at-a-glance`, `03-create-a-group`)
with `git mv` when the specification is written.

### What the specification says today

- **Tables** (`packages/api/src/Database/Schema.php`): `trips (id, name, start_date NOT NULL, end_date NOT NULL)`,
  `trip_members (trip_id, person_id)`, `trip_invites`, `trip_status_changes (trip_id, …)`, `expenses.trip_id`, the
  views (`v_trip_totals`, balances) and indexes on `trip_id`. The live database is kept on the host in
  `packages/api/var/app.sqlite` (with the admin account and its changes).
- **API and app code:** `/trips`, `/trips/{tripId}/…`, JSON fields `trip`, `trip_id`, the web link `?trip=8`, classes
  and files `TripController`, `TripService`, `TripView`, `MyTripsScreen`, `NewTripScreen`, …
- **Texts:** 38 English keys say "trip" ("My trips", "+ New trip", "Trip name", "Create trip", "Total trip spend",
  "This trip does not exist.", "You are not a member of this trip.", the tab "Trip", "Mark this trip as paid?", "A trip
  can have at most {max} people.", …), and the same in Spanish ("viaje") and French ("voyage").
- **New trip form:** name (required, 80 characters), start and end date **required**, prefilled with today; the end
  date may not be before the start. The trip view and the cards show "1 Jun 2026 – 7 Jun 2026".
- **Seed:** 8 trips ("Lisbon & Porto", "Madrid weekend", …) whose figures every spec's checks pin.

## Round 5

### Q1. How far does the rename go?
- [x] **Tables and texts, as asked:** tables, columns, indexes and views say `group` (`groups`, `group_members`,
  `group_invites`, `group_status_changes`, `expenses.group_id`), and every text in English, Spanish and French says
  group. The API paths (`/trips`), JSON fields (`trip`, `trip_id`), the `?trip=` link and the code names stay as they
  are, so the build stays small; the API is only used by this app (Recommended)
- [ ] **Everything:** also `/groups` paths, JSON fields `group` / `group_id`, the link `?group=8`, and code names
  (`GroupController`, `GroupView`, `MyGroupsScreen`, …). Bigger build, every API test and e2e test changes, no mixed
  naming left
- [ ] **Tables, texts and the API**, but not code names: `/groups` and `group_id` in JSON, `?group=8`; classes and files
  keep "Trip"

### Q2. The existing database (`packages/api/var/app.sqlite`)
- [x] Renamed in place at the next start (`bin/init-db.php`): each table and column is renamed and the views are
  recreated, so every group, expense, account and the admin's changes stay; a fresh database is created with the new
  names. The start log says "Renamed trips to groups." once (Recommended)
- [ ] Deleted and seeded again (the admin's changes and anything entered by hand are lost)

### Q3. Is there a kind of group (trip, gifts, other)?
- [x] No kind: a group is a name, its people and its expenses; "Gifts for Ben" and "Lisbon & Porto" work the same way
  (Recommended: what the rename needs; a kind can come later)
- [ ] A kind chosen on "New group" (Trip, Gifts, Other), stored on the group and shown on the card with an icon

### Q4. Dates of a group
A trip has a start and an end; a gift collection usually has none.
- [x] Optional: both dates empty, or both valid with the end not before the start. "New group" opens with both empty.
  Without dates, the card and the group header show no date line ("20 expenses" alone), and a new expense's date is
  today (Recommended)
- [ ] Required as today (prefilled with today's date)
- [ ] No dates at all: removed from the form, the cards and the database

New group with optional dates (correct it directly here):

```
┌──────────────────────────────────────┐
│                        [English  ▾] │  app bar
├──────────────────────────────────────┤
│ ‹ My groups                          │
│ New group                            │  title 20 bold
├──────────────────────────────────────┤
│ Group name                           │
│ ┌──────────────────────────────────┐ │
│ │ Gifts for Ben                    │ │
│ └──────────────────────────────────┘ │
│ Dates (optional)                     │  caption, inkMuted
│ ┌───────────────┐  ┌───────────────┐ │
│ │ Start date    │  │ End date      │ │  both empty
│ └───────────────┘  └───────────────┘ │
│ People                               │
│ Ana (you)                            │
│ ...                                  │
│ ┌──────────────────────────────────┐ │
│ │           Create group           │ │  primary, 56 high, bottom
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

My groups with a group without dates:

```
┌──────────────────────────────────────┐
│                        [English  ▾] │
├──────────────────────────────────────┤
│ My groups                            │
│ Logged in as Ana                     │
│ ┌──────────────────────────────────┐ │
│ │ Gifts for Ben                    │ │  no date line
│ │ Total                    40,00 € │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Lisbon & Porto                   │ │
│ │ 1 Jun 2026 – 7 Jun 2026          │ │
│ │ Total                 1.915,57 € │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │            + New group           │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### Q5. Order of "My groups" when some have no dates
Today the newest start date comes first.
- [x] Groups with dates by newest start date first, then groups without dates, newest created first
  (Recommended)
- [ ] Newest created first for every group, dates ignored

### Q6. The words in each language
- [x] **group / grupo / groupe:** "My groups" / "Mis grupos" / "Mes groupes", "+ New group" / "+ Nuevo grupo" /
  "+ Nouveau groupe", "Group name" / "Nombre del grupo" / "Nom du groupe", "Create group" / "Crear grupo" / "Créer le
  groupe", the tab "Group" / "Grupo" / "Groupe", "Total spent" / "Gasto total" / "Total des dépenses", "This group does
  not exist.", "Mark this group as paid?", "A group can have at most {max} people." (Recommended)
- [ ] Another word (write it below, in each language)

### Q7. Seed data
- [x] No seed change: the 8 seeded trips become groups with the same names, dates and figures, so no check's amount
  moves. A group without dates is created through "New group" in the checks (Recommended)
- [ ] Add a seeded group without dates (it would add a card to someone's list and change checks that count cards)

### Q8. Spec file names outside `specs/trips/`
- [x] `specs/accounts/02-login-and-my-trips-*` becomes `02-login-and-my-groups-*` too, with `git mv` (Recommended)
- [ ] Keep it; only the contents change

- [x] Round 5 answered (tick this when you have answered every question above)

### Decisions made while changing the specifications

Every round 5 recommendation was kept. These details were settled in the specifications and can be challenged there:

- **The views keep their names** (`v_trip_totals`, `v_trip_status`) and output columns (`trip_id`), so the API code
  stays as it is (round 5 Q1); only what they read changes.
- **The rename runs in one transaction** in `bin/init-db.php`; `groups` is rebuilt once (SQLite cannot drop `NOT NULL`
  in place), keeping every id. A failure leaves the database as it was and stops the start.
- **One date without the other** is `invalid_date` ("Enter a date as YYYY-MM-DD.") on the empty field: no new error
  code or text.
- **New key `newTrip.datesOptional`** ("Dates (optional)" / "Fechas (opcional)" / "Dates (facultatif)"); translation
  keys keep their code names (`trips.*`, `newTrip.*`, `trip.*`), only their texts say group.
- **"Total trip spend" becomes "Total spent"** ("Gasto total"; French already read "Total des dépenses").
- **The app name stays** "Travel expenses" / "Gastos de viaje" / "Frais de voyage": it has no "trip" and the round did
  not ask about it. Listed under Out of scope.
- **Checks:** in 03, checks 1–13 changed in wording and the new dates; 16 (a group without dates and the list order),
  17 (one date only), 18 (API) and 19 (renaming an existing database) are new. Every other spec's checks changed only
  in wording; their progress files are unticked where a check changed, with Screens and Tests (and Data and API in 03).
- **Spec 01** had "Out of scope" and "Check on iOS and Android" headings with extra words, which the spec guard did not
  accept; they now use the exact headings.
- **Spec guard (tooling):** renaming a feature's files one at a time with `git mv` was blocked; the guard now allows a
  rename inside the feature's own folder, and leaves the tooling estimates alone during `/spec`.
- **Not renamed:** `specs/roadmap.md` (the big picture, written with trips) and the estimate rows in spec 01, which are
  append-only and still name `specs/01-trip-at-a-glance-*`.
