# Epic 2: Login and my trips — brainstorming

Source: `specs/roadmap.md`, epic 2. Boundaries: `specs/guidelines/architecture.md`, `specs/guidelines/ui.md`.
Append-only: questions and answers are never changed once written. Answer by moving the `[x]` or adding a note under
the question.

## What exists today (for reference)

- **No accounts.** `people` holds only `id` and `name`. Each trip has its own `people` rows, linked through
  `trip_members`. The same real person on two trips is two unrelated rows.
- **API:** `GET /trips` (all trips, newest start date first, with `total_cents`), `GET /trips/{id}` (with members),
  `GET|POST /trips/{id}/expenses` (`?dry_run=1` for the split preview) and `GET /trips/{id}/summary`. There is no
  authentication. Errors are `{"error": {"code", "message"}}`, and validation errors are `422 {"errors": {field: {code,
  message}}}`. CORS preflight (`OPTIONS`) answers 204.
- **Recorder:** `POST /trips/{id}/expenses` takes `recorded_by` (a person id) from the client and rejects a non-member
  with `not_a_member`. The add expense form has a required "Recorded by" chip picker at the top.
- **App:** `App.tsx` opens `?trip={id}` on the web, or else the first trip from `GET /trips`. iOS and Android always open
  the first trip. Header = trip name. Tab bar = Trip | Balances | + Add expense. Loading, "Could not reach the API" and
  "This trip does not exist" states exist. There is no navigation library, only `useState`.
- **Seed:** "Lisbon & Porto" (trip 1: Ana, Ben, Chloé, David, 20 expenses), followed by the epic 1 fixture trips:
  2 "Empty weekend" (Eva, Finn, Greta), 3 "Even split" (Hugo, Iris), 4 "Three-way taxi" (Jon, Kim, Lea), 5 the long-name
  trip (Maximiliane…, Noah), 6 "Big group" (Olga, Paul, Quinn, Rosa, Sam, Tara). The epic 1 checks and e2e tests open
  these with `?trip=2…6`.
- **No device storage** dependency (no AsyncStorage or SecureStore) is in the inventory. On the web,
  `window.localStorage` is available without one.

---

## Round 1

### Q1. How does an account relate to the people on a trip?
Epic 3 adds name-only members and links them to an account by email later, so a trip member must be able to exist without
an account.
- [x] New `users` table (name, email, password hash). `people` gets a nullable `user_id`. One account is linked to one person row per trip. (Recommended: fits epic 3 without a migration later.)
- [ ] Add `email` and `password_hash` columns to `people`, so each person row can log in.
- [ ] One `people` row per real person, shared across trips (changes how the seed creates people).

### Q2. Where does the app keep the session token?
- [x] Web: `localStorage`, so a reload keeps you logged in. iOS and Android: in memory only, so you log in again after the app is closed. No new dependency. (Recommended)
- [ ] Add `expo-secure-store` (new dependency and an inventory entry) so iOS and Android stay logged in too.
- [ ] In memory on every platform: a browser reload logs you out.

### Q3. How long does a session last?
Sessions are opaque random tokens in a `sessions` table (only a hash of the token is stored).
- [ ] 30 days from the last request (sliding), and until "Log out" deletes it. (Recommended)
- [ ] Until "Log out", with no expiry.
- [x] 24 hours from login, or until logout deletes it.

### Q4. Which demo accounts does the seed create?
Every demo account gets the same known password, for example `travel-demo-2026`. Emails are `{name}@example.com` in
lowercase ASCII (`chloe@example.com`).
- [x] Ana, Ben, Chloé and David on "Lisbon & Porto". Add one new trip, "Madrid weekend", with Ana and Chloé only, so Ana and Chloé see two trips and Ben and David see one. Each fixture trip gets one account for its first person (Eva, Hugo, Jon, Noah, Olga), so the epic 1 checks still work by logging in as that person. (Recommended)
- [ ] As above, but one extra account "Test" that is a member of every fixture trip, under a person named "Test" in each.
- [ ] Only the four Lisbon accounts. The fixture trips keep no account and are no longer reachable in the app.

### Q5. Where does the app go after login, and how do you get back to the list?
- [x] Always to "My trips". Tapping a trip opens the epic 1 trip view. Its header gets a "‹ My trips" back button (at least 48 px). "Log out" sits in the "My trips" header. (Recommended)
- [ ] Straight into the most recent trip, with "My trips" reachable from the header.
- [ ] Add a fourth tab "My trips" to the tab bar.

### Q6. What happens to the web `?trip={id}` link?
- [x] Keep it. When you are logged in and a member, it opens that trip. When you are not a member, you see "You are not a member of this trip." and a "Go to My trips" button. When you are logged out, you see the login screen first and the trip opens after login. (Recommended)
- [ ] Remove it: the web always starts on "My trips".
- [ ] Keep it, but treat "not a member" the same as "This trip does not exist" (do not reveal that the trip exists).

### Q7. Sign-up rules
- [x] Name: required, 1 to 60 characters after trimming. Email: required, a plausible `x@y.z`, stored in lowercase and trimmed, unique. Password: at least 8 characters, at most 200. After sign-up you are logged in and see "My trips" (empty for a new account). (Recommended)
- [ ] As above, but the password also needs a digit and a letter.
- [ ] As above, but after sign-up you must log in again.

### Q8. What does the API do with `recorded_by` from the client?
- [x] Ignore it. The recorder is the logged-in account's person on that trip. The field goes away from the form and the app DTO. The `not_a_member` error for `recorded_by` is replaced by the 403 on the trip. (Recommended)
- [ ] Reject a request that sends `recorded_by` with 422.

- [x] Round 1 answered (tick this when you have answered every question above)

## Round 2

Screens. Correct any wireframe directly below it, or tick another option. All buttons are at least `size.tapMin`
(48 px) high, and primary buttons are `size.tapPrimary` (56 px) high.

### Q1. Login screen (new, `LoginScreen`)

```
┌──────────────────────────────────────┐
│                                      │
│ Travel expenses                      │  display 28, bold
│ Log in to see your trips.            │  body, inkMuted
│                                      │
│ Email                                │  caption
│ ┌──────────────────────────────────┐ │  keyboard: email-address,
│ │ ana@example.com                  │ │  no autocapitalise, no autocorrect
│ └──────────────────────────────────┘ │
│ Password                             │
│ ┌──────────────────────────────────┐ │  secureTextEntry;
│ │ ••••••••••••                     │ │  "Enter" submits
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │  owesSoft card, only after a
│ │ Email or password is wrong.      │ │  failed attempt
│ └──────────────────────────────────┘ │
│                                      │
│            (flexible space)          │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │             Log in               │ │  primary, accent, 56 high,
│ └──────────────────────────────────┘ │  at the bottom (thumb reach)
│   No account yet? Sign up            │  text button, 48 high
└──────────────────────────────────────┘
```
- [x] As drawn. (Recommended)
- [ ] As drawn, but the "Log in" button sits directly under the password field instead of at the bottom.

### Q2. Sign-up screen (new, `SignUpScreen`)

```
┌──────────────────────────────────────┐
│ ‹ Log in                             │  back text button, 48 high
│                                      │
│ Create an account                    │  display 28, bold
│                                      │
│ Your name                            │
│ ┌──────────────────────────────────┐ │
│ │ Ana                              │ │
│ └──────────────────────────────────┘ │
│ Email                                │
│ ┌──────────────────────────────────┐ │
│ │ ana@example.com                  │ │
│ └──────────────────────────────────┘ │
│ This email already has an account.   │  FieldError under the field
│ Password (at least 8 characters)     │
│ ┌──────────────────────────────────┐ │
│ │ ••••••••                         │ │
│ └──────────────────────────────────┘ │
│                                      │
│            (flexible space)          │
│ ┌──────────────────────────────────┐ │
│ │          Create account          │ │  primary, 56 high, bottom
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
- [x] As drawn. Field errors come from the API (`422`) and show under each field, as in the add expense form. (Recommended)
- [ ] As drawn, plus a second "Repeat password" field.

### Q3. "My trips" screen (new, `MyTripsScreen`)

```
┌──────────────────────────────────────┐
│ My trips                    Log out  │  header: title 20 bold;
├──────────────────────────────────────┤  "Log out" text button, 48 high
│ Logged in as Ana                     │  caption, inkMuted
│ ┌──────────────────────────────────┐ │
│ │ Madrid weekend                   │ │  one card per trip, whole card
│ │ 12 Sep – 14 Sep 2026             │ │  is a button (≥ 48 high);
│ │ Total             123,45 €       │ │  name: body bold, 2 lines max
│ └──────────────────────────────────┘ │  with "…"; dates: caption;
│ ┌──────────────────────────────────┐ │  total: Money, right aligned
│ │ Lisbon & Porto                   │ │  (amounts illustrative)
│ │ 1 Jun – 7 Jun 2026               │ │
│ │ Total           2.096,47 €       │ │  newest start date first
│ └──────────────────────────────────┘ │
│                                      │
└──────────────────────────────────────┘
```
Empty state (new account): a card "You are not on any trip yet. When someone adds you to a trip with your email, it
shows up here." No tab bar and no "+ New trip" on this screen (creating trips is epic 3).
- [x] As drawn, including the empty state text. (Recommended)
- [ ] As drawn, but without the "Logged in as Ana" line.
- [ ] Show the number of people and expenses on each card too.

### Q4. Trip view header (changed)

```
┌──────────────────────────────────────┐
│ ‹ My trips                           │  back text button, 48 high, accent
│ Lisbon & Porto                       │  trip name, title 20, 1 line, "…"
├──────────────────────────────────────┤
│  … epic 1 trip view, unchanged …     │
├──────────────────────────────────────┤
│ [  Trip  ] [Balances] [+ Add expense]│  tab bar unchanged
└──────────────────────────────────────┘
```
- [x] Back button on its own line above the trip name, so a long trip name keeps the full width. (Recommended)
- [ ] Back arrow "‹" and trip name on one line.

### Q5. Add expense form (changed)
The "Recorded by" section at the top goes away. Everything else stays as it is. The expense list still shows "Recorded by
{name}" on each row, now filled from the session.
- [x] Remove the section. Nothing replaces it. (Recommended)
- [ ] Replace it with a read-only line "Recorded by Ana (you)".

### Q6. "Not a member" state (new, web `?trip=` only)

```
┌──────────────────────────────────────┐
│                                      │
│                                      │
│   You are not a member of this trip. │  centred, like "This trip
│        ┌────────────────────┐        │  does not exist"
│        │   Go to My trips   │        │  accent button, 48 high
│        └────────────────────┘        │
│                                      │
└──────────────────────────────────────┘
```
"This trip does not exist" keeps its state, but its button changes from "Open the demo trip" to "Go to My trips".
- [x] As drawn. (Recommended)
- [ ] Skip this state and send the person straight to "My trips".

### Q7. What happens when the session runs out (24 hours) or the API answers 401 at any point?
- [x] The app forgets the token and shows the login screen with an info line "Your session has ended. Please log in again." After logging in, it goes to "My trips". An unsaved expense form is lost. (Recommended)
- [ ] As above, but after logging in it returns to the trip that was open.

- [x] Round 2 answered (tick this when you have answered every question above)

## Round 3

API, errors and seed data.

### Q1. Endpoints
Request and response shapes. All money stays in `_cents`. Every trip endpoint needs `Authorization: Bearer {token}`.
CORS adds `Authorization` to the allowed headers. The token is safe to send cross-origin because no cookies are used.
```
POST /auth/signup  {name, email, password}  → 201 {token, user: {id, name, email}}
POST /auth/login   {email, password}        → 200 {token, user: {id, name, email}}
POST /auth/logout                           → 204 (deletes this session)
GET  /me                                    → 200 {id, name, email}
GET  /trips          → only my trips: [{id, name, start_date, end_date, total_cents}], newest start date first
GET  /trips/{id}, /trips/{id}/expenses, /trips/{id}/summary, POST /trips/{id}/expenses → unchanged shapes
```
- [x] As listed. The app calls `GET /me` at start-up to check a stored token and get the name for "Logged in as …". (Recommended)
- [ ] As listed, but without `GET /me`: the app also stores the user's name in `localStorage` next to the token.

### Q2. Error responses
- [x] Missing, unknown or expired token → `401 unauthenticated` on every endpoint except signup and login. Unknown trip → `404 not_found`. A trip that exists but you are not a member of → `403 not_a_member`. 404 is checked before 403. Login with an unknown email or a wrong password → `401 invalid_credentials` with the same message for both. Sign-up → `422` with field errors: `name` (`required`, `too_long`), `email` (`required`, `invalid_email`, `taken`), `password` (`too_short`, `too_long`). (Recommended)
- [ ] As above, but a distinct `401 session_expired` for an expired token, so the app could word it differently.

### Q3. Login attempts
- [x] No rate limit or lockout in this epic. The roadmap already excludes password reset and verification. List it under Out of scope. (Recommended)
- [ ] Lock an email for 5 minutes after 5 failed attempts.

### Q4. Docker health check
The `api` health check fetches `GET /trips`. Without a token this becomes a 401, so the check would fail and `app` would
never start.
- [x] Add `GET /health` → `200 {"ok": true}`, no token needed, and point the health check at it. (Recommended)
- [ ] Point the health check at `POST /auth/login` with a demo account.

### Q5. "Madrid weekend" seed trip (Ana and Chloé only)
It goes after the fixture trips, so trips 1 to 6 keep their ids and the epic 1 links still work. Exact euro amounts in
the spec come from running the real API code on a fresh database.
- [x] 12–14 Sep 2026, two expenses: "Tapas at Mercado de San Miguel" 48,30 € paid by Chloé, split equally; "Prado Museum tickets" 30,00 € paid by Ana, split equally. Total 78,30 €, so Ana pays Chloé 9,15 €. Ana's list: Madrid weekend (top, newest start date), then Lisbon & Porto. (Recommended)
- [ ] Same trip, no expenses (0,00 €), so a list row with a zero total is covered.

### Q6. Edge cases for "My trips" and login. Untick any you do not want as an acceptance check.
- [x] New account from sign-up → empty state card.
- [x] Noah (long-name trip): the name wraps to 2 lines and ends in "…", and the total 2.345.678,91 € (or whatever the API returns) fits on the card next to "Total".
- [x] Eva ("Empty weekend"): the row shows 0,00 €.
- [x] Email typed with capitals and spaces (`  ANA@Example.com `) logs in.
- [x] API unreachable on the login screen: the error card reads "Could not reach the API at {url}." and the button stays usable.
- [x] Ben opens `/?trip={Madrid id}` → "You are not a member of this trip."
- [x] A token deleted by logout no longer works: the API answers 401.
- [x] An expense POSTed with `recorded_by` of another member is saved with the logged-in person as recorder.

### Q7. Same name on sign-up as an existing account?
Names are display only. Only email must be unique.
- [x] Allowed. (Recommended)
- [ ] Rejected.

- [x] Round 3 answered (tick this when you have answered every question above)

## Decisions made while writing the specification

- Demo password for every seeded account: `travel-demo-2026`. "Madrid weekend" is trip 7. Its figures (`78,30 €`, Ana
  pays Chloé `9,15 €`, and `84,30 €` / `6,15 €` after adding "Churros" `6,00 €`) come from the real API code.
- "My trips" shows the full total (`2.345.678,91 €`), not the compact `2,34 M €` from the trip hero, as Round 3 Q6
  describes. Dates use the trip view format (`1 Jun 2026 – 7 Jun 2026`).
- A session lasts 24 hours from login or sign-up and is not extended (Round 1 Q3). The token is 32 random bytes in hex,
  and only its SHA-256 is stored.
- Login with an empty email or password answers `401 invalid_credentials`, not `422`, so login never hints at which
  part was wrong.
- Logout forgets the token in the app even when the API request fails.
- Existing dev databases need `docker compose down -v` once. There is no schema migration.
- The epic 1 e2e suite logs in as each fixture trip's owner. Its add-expense check records as Jon.
- The `localStorage` key is `travel-expenses.token`.

# Change: paid groups folded away, and what I owe and am owed

## What the specification says today

- "My groups" (`MyTripsScreen`, wireframe in `specs/groups/03-create-a-group-specification.md`) is one list: groups with
  dates by newest start date first, then groups without dates, newest first. Each card shows the name, the date line
  (if any), "Total" and the total. "+ New group" is fixed at the bottom.
- A group marked as paid shows the chip "✓ Paid" on its card and stays in its place in the list
  (`specs/expenses/04-edit-expenses-and-mark-as-paid-specification.md`, check 10). That spec lists "moving paid groups to
  the bottom of My groups" and "new seed data (paid groups …)" as out of scope.
- A card shows no money per person: who owes whom is only visible inside a group ("Who owes whom", Balances).
- `GET /trips` returns per group `id, name, start_date, end_date, total_cents, paid`. The suggested transfers come from
  `SettlementService` per group (`GET /trips/{id}/summary`).
- Seed figures for the people with accounts (open groups, today's transfers): Ana pays Ben `63,75 €` (Lisbon & Porto)
  and Chloé `9,15 €` (Madrid weekend); David pays Ben `27,65 €` and Chloé `27,07 €` (Lisbon & Porto). No seeded group
  is paid.

## Round 4

### Q1. Which groups go into the folded section?
- [x] Only groups marked as paid (Recommended)
- [ ] Groups marked as paid, and also open groups where everyone is already settled
- [ ] Groups marked as paid, and groups whose end date is in the past

### Q2. How does the folded section behave?
- [x] Below the open groups, one row "Paid groups (3) ▸", 48 px high, closed every time "My groups" opens; tapping it shows the paid cards below it and turns into "Paid groups (3) ▾"; hidden when there are no paid groups (Recommended)
- [ ] The same, but the device remembers whether it was open
- [ ] The same, but the row is still shown with "(0)" when there are no paid groups

### Q3. What does "I owe" / "I am owed" look like?
- [x] A summary card at the top of "My groups" with two totals, "I owe" and "I'm owed"; tapping one of them is a filter: it shows only the groups where that applies, each with the people involved; tapping it again shows all groups (Recommended)
- [ ] Three filter chips above the list, "All", "I owe", "I'm owed", and the totals only inside the filtered views
- [ ] A separate "Debts" screen opened from "My groups" or the menu

### Q4. How are the people I owe (or who owe me) worked out and listed?
- [x] From each group's suggested transfers, the same as "Who owes whom": only the transfers where I pay or am paid, listed per group ("Lisbon & Porto · You pay Ben 63,75 €") (Recommended)
- [ ] My net balance per group only ("Lisbon & Porto · You owe 63,75 €"), without naming people
- [ ] Added up per person across all groups ("Ben · You owe 63,75 €"), a name-only member counting as a different person in each group

### Q5. Do debts in paid groups count?
- [x] No: a paid group counts as settled, so it adds nothing to "I owe" or "I'm owed" (Recommended)
- [ ] Yes, they still count until the numbers are zero

### Q6. Does every group card show my own position, also without a filter?
- [x] Yes, one line under the total: "You owe 72,90 €" (owes colour), "You're owed 9,15 €" (gets colour) or "Settled" (muted); paid cards show no such line (Recommended)
- [ ] No, cards stay as they are; the money per person appears only in the filtered view

### Q7. "I owe" and "I'm owed" at the same time (I owe in one group and am owed in another)?
- [x] Both totals are shown separately and never netted against each other, because they are different people and groups (Recommended)
- [ ] Also show the difference as "Net"

### Q8. Wireframe: "My groups" as Ana, no filter, paid section closed (correct anything you want changed)

Assumes "Madrid weekend" was marked as paid; the figures are Ana's today.

```
┌──────────────────────────────────────┐
│                        [English  ▾] │  app bar (unchanged)
├──────────────────────────────────────┤
│ My groups                            │  header (unchanged)
│ Logged in as Ana                     │
│ ┌────────────────┐┌────────────────┐ │  summary: two halves, each a
│ │ I owe          ││ I'm owed       │ │  filter button ≥ 48 high;
│ │       63,75 €  ││        0,00 €  │ │  owes / gets colours
│ └────────────────┘└────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Lisbon & Porto                   │ │  open groups, same order
│ │ 1 Jun 2026 – 7 Jun 2026          │ │  as today
│ │ Total                 1.915,57 € │ │
│ │ You owe                  63,75 € │ │  new line, owes colour
│ └──────────────────────────────────┘ │
│ Paid groups (1)                   ▸  │  row, 48 high, closed
│            (list scrolls)            │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │           + New group            │ │  unchanged, fixed
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
- [x] Like this (Recommended)
- [ ] Changes (write them under this question)

### Q9. Wireframe: "I owe" tapped (filter on)

```
┌──────────────────────────────────────┐
│ My groups                            │
│ Logged in as Ana                     │
│ ┌────────────────┐┌────────────────┐ │  "I owe" selected: accent
│ │ I owe        ✓ ││ I'm owed       │ │  border + ✓; tap again
│ │       63,75 €  ││        0,00 €  │ │  to show all groups
│ └────────────────┘└────────────────┘ │
│ Groups where you owe money           │  caption, inkMuted
│ ┌──────────────────────────────────┐ │
│ │ Lisbon & Porto                   │ │  card opens the group
│ │ You pay Ben              63,75 € │ │  one row per transfer
│ └──────────────────────────────────┘ │  that involves me
│                                      │  no paid section while
│                                      │  a filter is on
└──────────────────────────────────────┘
```
With nothing to show: a card "You don't owe anyone." / "Nobody owes you."
- [x] Like this (Recommended)
- [ ] Changes (write them under this question)

### Q10. Where does the API give the app these numbers? (all calculated in the API)
- [ ] `GET /trips` adds per group `my_net_cents` and `my_transfers: [{ direction: "pay" | "receive", person: { id, name }, amount_cents }]` (empty for paid groups), plus nothing else; the app adds no money, so the two totals come from the API too: `GET /trips` becomes `{ trips: [...], owe_cents, owed_cents }` (Recommended)
- [x] A separate `GET /me/debts` with the totals and the transfers; `GET /trips` stays as it is
- [ ] `GET /trips` stays a list, and the totals come from a new `GET /me/debts/summary`

- [x] Round 4 answered (tick this when you have answered every question above)

## Round 5

Figures per demo account on a fresh seed, from the current API code (`SummaryService` on an in-memory seeded
database), open groups only:

| Account | I owe | I'm owed | From |
|---|---|---|---|
| Ana | `72,90 €` | `0,00 €` | pays Ben `63,75 €` (Lisbon & Porto), pays Chloé `9,15 €` (Madrid weekend) |
| Ben | `0,00 €` | `91,40 €` | Ana `63,75 €`, David `27,65 €` (Lisbon & Porto) |
| Chloé | `0,00 €` | `36,22 €` | Ana `9,15 €` (Madrid weekend), David `27,07 €` (Lisbon & Porto) |
| David | `54,72 €` | `0,00 €` | pays Ben `27,65 €`, Chloé `27,07 €` (Lisbon & Porto) |
| Eva, Hugo | `0,00 €` | `0,00 €` | Empty weekend / Even split: settled |
| Jon | `0,00 €` | `6,66 €` | Kim `3,33 €`, Lea `3,33 €` (Three-way taxi) |
| Noah | `0,00 €` | `1.172.839,46 €` | Maximiliane Alexandra von Hohenzollern-Sigmaringen (Great tour …) |
| Olga | `0,00 €` | `50,00 €` | Quinn `20,00 €`, Rosa `20,00 €`, Sam `10,00 €` (Big group) |
| Pia | `0,00 €` | `200,00 €` | Inés `100,00 €`, Grandpa `100,00 €` (Ski week) |

Nobody both owes and is owed today, and no seeded group is paid.

### Q1. Shape of `GET /me/debts` (you chose a separate endpoint in Round 4 Q10)
The cards need my position in every open group ("You owe …" / "You're owed …" / "Settled"), so the endpoint lists all
of them, not only the ones with money.
- [ ] `200 { owe_cents, owed_cents, groups: [{ trip_id, my_net_cents, transfers: [{ direction: "pay" | "receive", person: { id, name }, amount_cents }] }] }` with every open group I am on (settled ones with `my_net_cents: 0` and `transfers: []`), in the order of `GET /trips`; paid groups are left out; `401` without a token (Recommended)
- [x] The same, but only groups with at least one transfer; a card without an entry shows "Settled"
- [ ] Only the two totals and the transfers, and the cards show no position line (drops Round 4 Q6)

### Q2. Loading and errors on "My groups" (now two requests)
- [x] Both requests run at once; the spinner shows until both answer; if either fails, the existing "Could not reach the API at {url}." with "Try again", which repeats both (Recommended)
- [ ] The list shows as soon as `GET /trips` answers; the summary card shows its own small error with "Try again" if `GET /me/debts` fails
- [ ] The list shows as soon as `GET /trips` answers; the summary and position lines are left out silently if `GET /me/debts` fails

### Q3. The summary card when I am on no group at all (e.g. a new account)
- [x] Hidden: only the existing empty-list card shows (Recommended)
- [ ] Shown with `0,00 €` and `0,00 €`

### Q4. How long does a filter stay on?
- [x] Until it is tapped again or "My groups" is left (opening a group and coming back shows all groups again) (Recommended)
- [ ] Until it is tapped again, also after opening a group and coming back, while the app runs

### Q5. Seed data for the paid section
The paid section needs a paid group; today's seed has none and spec 04 kept it that way.
- [x] No seed change: the checks mark "Madrid weekend" as paid through the app first (as spec 04 does), so every other check and id stays the same (Recommended)
- [ ] Seed one more paid group for Ana (gets id 9, so the groups created in spec 03's checks become 10, 11, 12 and those checks change)
- [ ] Seed "Madrid weekend" as paid (spec 04's mark-as-paid checks would then start by reopening it)

### Q6. Edge cases to turn into acceptance checks (untick any you do not want)
- [x] Ana, fresh seed: "I owe" `72,90 €`, "I'm owed" `0,00 €`; Lisbon & Porto "You owe 63,75 €", Madrid weekend "You owe 9,15 €"; no "Paid groups" row
- [x] Ana marks "Madrid weekend" as paid: "I owe" becomes `63,75 €`, Madrid moves into the closed "Paid groups (1) ▸"; opening it shows the card with "✓ Paid" and no position line; reopening Madrid brings it back to the open list and `72,90 €`
- [x] "I owe" filter as Ana: only Lisbon & Porto with "You pay Ben 63,75 €"; "I'm owed" filter: "Nobody owes you."
- [x] Owing and owed at once: Ana creates a group with Ben ("Coffee club"), records `10,00 €` paid by Ana split equally: "I owe" stays `72,90 €`, "I'm owed" becomes `5,00 €`, never netted
- [x] Three people owe me in one group: Olga's "I'm owed" filter lists Big group with Quinn `20,00 €`, Rosa `20,00 €`, Sam `10,00 €`, total `50,00 €`
- [x] Uneven cents: Jon is owed `6,66 €` (Kim `3,33 €`, Lea `3,33 €`)
- [x] Everyone settled: Hugo sees `0,00 €` / `0,00 €` and "Settled" on Even split; both filters show their empty text
- [x] Long name, very large amount: Noah's "I'm owed" filter shows `1.172.839,46 €` from "Maximiliane Alexandra von Hohenzollern-Sigmaringen" on one row without sideways scrolling (the name wraps or ends in "…", the amount stays on one line)
- [x] No groups: a new account sees no summary card, only the empty-list text
- [x] API unreachable: "My groups" shows the error and "Try again"; `GET /me/debts` without a token answers `401`

### Q7. A name in a transfer row that is too long for one line
- [x] The name wraps to at most 2 lines and ends in "…"; the amount stays on one line, right-aligned (same rule as the group names on the cards) (Recommended)
- [ ] One line with "…"

- [x] Round 5 answered (tick this when you have answered every question above)

## Decisions made while writing the specification (rounds 4–5)

- Each group in `GET /me/debts` carries `owe_cents` and `owed_cents` instead of `my_net_cents`, so the card's "You owe
  …" / "You're owed …" amount comes straight from the API and the app never negates a cent (architecture rule 6).
- Check 24 runs after check 23 has reopened "Madrid weekend", so the "I owe" filter lists both Madrid (`9,15 €`) and
  Lisbon (`63,75 €`); the Round 5 example with Lisbon only described the state while Madrid was paid.
- The "owing and owed at once" case uses a group created in the app ("Coffee club", group 9 on a fresh seed), so the
  seed and every other check keep their ids. Checks 22–31 run on their own fresh seed in a new `my-groups.test.ts`.
- The empty state and "+ New group" in spec 02's "My groups" now point to epic 3's texts, which already applied.
- Touched elsewhere: spec 04 check 10 (Madrid is found under "Paid groups") and its out-of-scope line; spec 03's
  "My groups" wireframe; spec 06's text table (11 new keys).
