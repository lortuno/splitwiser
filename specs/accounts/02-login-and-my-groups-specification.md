# Epic 2: Login and my groups — specification

Source: `specs/roadmap.md`, epic 2. Brainstorming: `specs/accounts/02-login-and-my-groups-brainstorming.md` (rounds 1–5).
Boundaries: `specs/guidelines/architecture.md`, `specs/guidelines/ui.md`.

## Estimate

Development hours only, as defined in "Estimates" in AGENTS.md. Rows are append-only.

| Date | Task | Estimate (h) | Actual (h) |
|---|---|---|---|
| 2026-10-27 | Build the epic | 1 | 1 |

## Goal

Everyone logs in with their own account. They can sign up (name, email, password) or log in, and then they see "My groups":
only the groups they are a member of, with dates and totals. At the top, "I owe" and "I'm owed" show how much they owe
and are owed across their open groups; tapping one filters the list to the groups where that applies, with the people
involved. Each open group's card shows their own position in it. Groups marked as paid are folded into a closed "Paid
groups" section at the bottom of the list, so they take no space until it is opened. Tapping a group opens the epic 1
group view. Expenses are
recorded as the logged-in person, because the API takes the recorder from the session and the "Recorded by" picker is
gone. Every group endpoint needs a Bearer token. A group you are not a member of answers 403. No new package, service or
dependency.

## Screens

### App shell (`App.tsx`)

- **Start-up:** on the web, the app reads the token from `localStorage`. On iOS and Android it keeps the token in memory
  only, so after a restart the app starts at Login. With a token, the app calls `GET /me`. While that request runs, it
  shows the existing centred spinner with "Loading…". `200` leads to "My groups", or to the group from `?trip=` on the
  web. `401` makes the app forget the token and show Login.
- **Any `401` from any request** while logged in: the app forgets the token and shows Login with the info line "Your
  session has ended. Please log in again." Whatever was on screen is dropped, including an unsaved expense form. After
  logging in again, "My groups" opens.
- **`?trip={id}` (web only):** logged in and a member → that group view. Logged out → Login first, and after login that
  group opens. Not a member (`403`) → the "not a member" state. Unknown id (`404`) or an invalid id (no request is sent)
  → "This group does not exist."
- **API unreachable at start-up:** unchanged. "Could not reach the API at {url}." and "Try again".
- **Not-found state (changed):** "This group does not exist." The button now reads **"Go to My groups"** (was "Open the
  demo group"). It removes `?trip=` from the URL and opens "My groups".
- **Not-a-member state (new):** "You are not a member of this group." and a **"Go to My groups"** button (accent, at least
  48 px high), centred like the not-found state. Tapping it does the same as the not-found button.

```
┌──────────────────────────────────────┐
│                                      │
│  You are not a member of this group. │  centred
│        ┌────────────────────┐        │
│        │  Go to My groups   │        │  accent button, 48 high
│        └────────────────────┘        │
│                                      │
└──────────────────────────────────────┘
```

### Login (`LoginScreen`, new)

```
┌──────────────────────────────────────┐
│                                      │
│ Travel expenses                      │  display 28, bold
│ Log in to see your groups.           │  body, inkMuted
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

- **Log in** (`size.tapPrimary`, bottom): sends `POST /auth/login` with the email and password exactly as typed (the
  API trims the email and lowercases it). While the request runs, the button reads "Logging in…" and is disabled. On
  success the app stores the token and opens "My groups", or the pending `?trip=` group.
- **Error card** (`owesSoft`): `401 invalid_credentials` → "Email or password is wrong." The API is unreachable →
  "Could not reach the API at {url}." The fields keep their values and "Log in" can be tapped again.
- **Info line** (caption, `inkMuted`, above the fields): "Your session has ended. Please log in again." Shown only
  after a `401` while logged in.
- **No account yet? Sign up** (text button, `size.tapMin`): opens Sign-up.
- An empty email or password is sent to the API as it is. The API answers `401 invalid_credentials`. No check happens
  in the app.

### Sign-up (`SignUpScreen`, new)

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

- **‹ Log in** (`size.tapMin`): back to Login. Nothing is sent.
- **Create account** (`size.tapPrimary`, bottom): `POST /auth/signup`. While the request runs: "Creating account…",
  disabled. `201` → token stored, "My groups" opens (empty for a new account). `422` → the API message for each field
  appears under that field (`FieldError`), and the form keeps its values. The API is unreachable → the error card from
  Login above the button.
- Email field: `email-address` keyboard, no autocapitalise, no autocorrect. Password: `secureTextEntry`.

### My groups (`MyTripsScreen`)

All groups, no filter, as Ana on a fresh seed after "Madrid weekend" was marked as paid ("Paid groups" closed):

```
┌──────────────────────────────────────┐
│                        [English  ▾] │  app bar (epic 6): its menu
├──────────────────────────────────────┤  holds "Settings", "Log out"
│ My groups                            │  header: title 20 bold
│ Logged in as Ana                     │  caption, inkMuted
│ ┌────────────────┐┌────────────────┐ │  summary: two halves, each a
│ │ I owe          ││ I'm owed       │ │  filter button ≥ 48 high;
│ │       63,75 €  ││        0,00 €  │ │  amounts owes / owed colour
│ └────────────────┘└────────────────┘ │
│ ┌──────────────────────────────────┐ │  open groups, in the order
│ │ Lisbon & Porto                   │ │  of GET /trips; whole card
│ │ 1 Jun 2026 – 7 Jun 2026          │ │  is a button (≥ 48 high)
│ │ Total                 1.915,57 € │ │
│ │ You owe                  63,75 € │ │  position line, owes colour
│ └──────────────────────────────────┘ │
│ Paid groups (1)                   ▸  │  row, 48 high, closed
│            (list scrolls)            │
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │           + New group            │ │  epic 3, fixed at the bottom
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

Filter "I owe" on:

```
┌──────────────────────────────────────┐
│                        [English  ▾] │
├──────────────────────────────────────┤
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
│                                      │  no "Paid groups" row
├──────────────────────────────────────┤
│ ┌──────────────────────────────────┐ │
│ │           + New group            │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

- **Data:** `GET /trips` and `GET /me/debts`, sent at the same time. The screen shows the spinner until both answer.
  The name in "Logged in as {name}" comes from `GET /me`, or from the login or sign-up response. All amounts on this
  screen come from the API; the app adds, subtracts and negates no money (architecture rule 6).
- **Summary** (above the cards, only when `GET /trips` lists at least one group): two halves side by side, each a
  button at least `size.tapMin` high. "I owe" shows `owe_cents`, in `owes` colour; "I'm owed" shows `owed_cents`, in
  `owed` colour; each on one line, right-aligned. Both totals cover open groups only and are never netted against each
  other. A user with only paid groups sees `0,00 €` and `0,00 €`.
- **Filters:** tapping "I owe" or "I'm owed" selects it (accent border, "✓" after the label, `accessibilityState`
  selected) and replaces the list by the filtered view; tapping the selected half again shows all groups; tapping the
  other half switches to it. A filter is off whenever "My groups" opens, including after "‹ My groups" from a group.
  - **Filtered view:** the caption "Groups where you owe money" / "Groups where you are owed money", then one card per
    group in `GET /me/debts` with a transfer in that direction, in the order of `GET /trips`. A card shows the group
    name (2 lines max, "…") and one row per transfer: "You pay {name}" or "{name} pays you" with `amount_cents` on the
    right, on one line. The person's name wraps to at most 2 lines and ends in "…". Tapping a card opens the group.
  - **Nothing to show:** a card "You don't owe anyone." / "Nobody owes you.".
  - The "Paid groups" row and paid cards are not shown while a filter is on.
- **Group cards (no filter):** name (wraps to 2 lines, "…"), the date line (same format as the group view, left out for
  a group without dates), "Total" with the full amount (`formatCents`, e.g. `2.345.678,91 €`) on one line,
  right-aligned. An open group's card has a position line under the total, from its entry in `GET /me/debts`: "You owe"
  with its `owe_cents` (`owes` colour), or "You're owed" with its `owed_cents` (`owed` colour); an open group without an
  entry shows "Settled" (`inkMuted`, no amount). A paid group's card shows "✓ Paid" next to the name and no position
  line.
- **Order:** open groups first, in the order of `GET /trips`; then the "Paid groups" row.
- **Paid groups** (only when at least one group is paid): a row "Paid groups ({count})" with "▸", full width, at least
  `size.tapMin` high, `accessibilityRole="button"` with `accessibilityState` expanded. Closed whenever "My groups" opens.
  Tapping it shows the paid cards below it, in the order of `GET /trips`, and the row turns into "Paid groups ({count})
  ▾"; tapping again hides them.
- **Tap a card:** opens the group view for that group on the Group tab. On the web the URL becomes `?trip={id}`.
- **Log out** (a row of the menu in the app bar, `size.tapMin`, on every screen after login; see
  `specs/translations/06-translations-specification.md`): `POST /auth/logout`, then the app forgets the token and
  shows Login. If the request fails (unreachable or `401`), the app still forgets the token and shows Login. "Log out"
  in the checks means: open the menu and tap "Log out".
- **Empty state:** no summary, no "Paid groups" row, and the empty-list card of epic 3 ("You are not on any group yet.
  Start one with "+ New group", or ask a friend to add you with your email.").
- **Loading:** the centred spinner with "Loading…". **Error:** when either request fails, "Could not reach the API at
  {url}." with "Try again", centred, as in the app shell; "Try again" sends both requests again. A `401` from either is
  handled by the app shell.
- No tab bar. "+ New group" is specified in `specs/groups/03-create-a-group-specification.md`.
- **New texts** (en / es / fr): `debts.owe` I owe / Debo / Je dois; `debts.owed` I'm owed / Me deben / On me doit;
  `debts.youOwe` You owe / Debes / Vous devez; `debts.youreOwed` You're owed / Te deben / On vous doit; `debts.youPay`
  You pay {name} / Pagas a {name} / Vous payez {name}; `debts.paysYou` {name} pays you / {name} te paga / {name} vous
  paie; `debts.oweHeading` Groups where you owe money / Grupos en los que debes dinero / Groupes où vous devez de
  l’argent; `debts.owedHeading` Groups where you are owed money / Grupos en los que te deben dinero / Groupes où l’on
  vous doit de l’argent; `debts.oweEmpty` You don't owe anyone. / No le debes nada a nadie. / Vous ne devez rien à
  personne.; `debts.owedEmpty` Nobody owes you. / Nadie te debe nada. / Personne ne vous doit rien.;
  `trips.paidGroups` Paid groups ({count}) / Grupos pagados ({count}) / Groupes payés ({count}). "Settled" reuses
  `balances.settledNet`, "✓ Paid" `common.paid`.

### Group view header (changed)

```
┌──────────────────────────────────────┐
│ ‹ My groups                          │  back text button, 48 high, accent
│ Lisbon & Porto                       │  group name, title 20, 1 line, "…"
├──────────────────────────────────────┤
│  … epic 1 group view, unchanged …    │
├──────────────────────────────────────┤
│ [ Group  ] [Balances] [+ Add expense]│  tab bar unchanged
└──────────────────────────────────────┘
```

- **‹ My groups** (`size.tapMin`, on its own line): back to "My groups", which loads again so the totals are up to date.
  On the web, `?trip=` is removed from the URL.
- The group view, the Balances tab and the tab bar are unchanged from epic 1.

### Add expense (`AddExpenseScreen`, changed)

- The **"Recorded by"** section and its error are removed. Nothing replaces them. The request no longer sends
  `recorded_by`. Amounts still use `decimal-pad` / `inputMode="decimal"`.
- After saving, the group view updates from the returned summary, as in epic 1. The new row reads "Recorded by {name of
  the logged-in person on this group}".

## Data

**Schema changes** (`packages/api/src/Database/Schema.php`):

- New table `users`: `id INTEGER PRIMARY KEY`, `name TEXT NOT NULL`, `email TEXT NOT NULL UNIQUE` (trimmed, lowercase),
  `password_hash TEXT NOT NULL` (`password_hash(..., PASSWORD_DEFAULT)`), `created_at TEXT NOT NULL DEFAULT
  CURRENT_TIMESTAMP`.
- New table `sessions`: `token_hash TEXT PRIMARY KEY` (SHA-256 hex of the token, never the token itself), `user_id
  INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE`, `created_at TEXT NOT NULL`, `expires_at TEXT NOT NULL`
  (24 hours after login or sign-up, not extended). Index on `user_id`.
- `people` gets `user_id INTEGER NULL REFERENCES users (id)`, with an index. One account is linked to at most one person
  row per group. The API enforces this, and the seed is the only writer in this epic.
- Membership: a user is a member of a group when one of the group's `trip_members` people has `people.user_id = user`.
- An existing dev database has no `users` table, and it already has groups, so the seed would not run again. Reset it
  once with `docker compose down -v`. Dev data only, no migration.

**Writes:** sign-up inserts a user and a session. Login inserts a session. Logout deletes its session.
`POST /trips/{id}/expenses` writes `recorded_by` = the logged-in user's person on that group.
**Reads:** the session by token hash (an expired session counts as missing), the user, and that user's groups with
`total_cents` from `v_trip_totals`. For `GET /me/debts`: the user's open groups (`v_trip_status`), the user's person
on each (`TripRepository::personForUser`), and each group's suggested transfers from `SummaryService` (the same as "Who
owes whom"). A new `DebtService` keeps only the transfers whose `from` or `to` is the user's person and adds up the
totals; no schema change and no new view.
**App:** the token is kept in `src/api/session.ts`, in `localStorage` (key `travel-expenses.token`) on the web and in
memory on iOS and Android. `src/api/client.ts` adds `Authorization: Bearer {token}` to every request. On a `401` it
clears the token and reports it to `App.tsx`. The app adds, subtracts and divides no money (architecture rule 6).

## API

Every endpoint except `GET /health`, `POST /auth/signup` and `POST /auth/login` needs `Authorization: Bearer {token}`.
CORS: `Access-Control-Allow-Headers: Content-Type, Authorization` and `Access-Control-Allow-Methods: GET, POST, OPTIONS`.
Errors keep the existing shapes: `{ error: { code, message } }`, and for validation `422 { errors: { field: { code,
message } } }`. All money is in integer `_cents`.

| Request | Response |
|---|---|
| `GET /health` | `200 { ok: true }`. No token. The Docker health check of `api` uses it instead of `GET /trips`. |
| `POST /auth/signup` `{ name, email, password }` | `201 { token, user: { id, name, email } }`. `422` field errors: `name` `required` ("Enter your name.") / `too_long` (> 60 characters after trimming, "Use at most 60 characters."); `email` `required` / `invalid_email` (not `x@y.z` after trimming, "Enter an email like ana@example.com.") / `taken` ("This email already has an account."); `password` `too_short` (< 8 characters, "Use at least 8 characters.") / `too_long` (> 200 characters). Names may repeat. |
| `POST /auth/login` `{ email, password }` | `200 { token, user: { id, name, email } }`. The email is trimmed and lowercased before the lookup. An unknown email, a wrong password or an empty field → `401 { error: { code: "invalid_credentials", message: "Email or password is wrong." } }`. |
| `POST /auth/logout` | `204`. Deletes the session for this token. Without a valid token → `401 unauthenticated`. |
| `GET /me` | `200 { id, name, email }` |
| `GET /trips` | `200 [{ id, name, start_date, end_date, total_cents, paid }]`. Only groups the user is a member of, in the order of `specs/groups/03-create-a-group-specification.md` (dated groups by `start_date` desc, then groups without dates by `id` desc). `[]` when there are none. |
| `GET /me/debts` | `200 { owe_cents, owed_cents, groups: [{ trip_id, owe_cents, owed_cents, transfers: [{ direction: "pay" \| "receive", person: { id, name }, amount_cents }] }] }`. `groups` lists only the user's **open** groups with at least one transfer that involves the user, in the order of `GET /trips`; `transfers` are those transfers, in the order of the group's summary, `person` being the other side (with the shown name). A group's `owe_cents` is the sum of its `pay` transfers and `owed_cents` the sum of its `receive` transfers; the top-level totals add these up over all groups. Paid groups are left out. `{ owe_cents: 0, owed_cents: 0, groups: [] }` when there is nothing. |
| `GET /trips/{id}` | Unchanged shape. |
| `GET /trips/{id}/expenses` | Unchanged shape. |
| `GET /trips/{id}/summary` | Unchanged shape. |
| `POST /trips/{id}/expenses` (and `?dry_run=1`) | Unchanged shape. `recorded_by` in the body is ignored. The recorder is the user's person on the group. The `recorded_by` validation error no longer exists. |

Errors for all endpoints that need a token, checked in this order:

1. No `Authorization` header, a token that is not a session, or an expired session → `401 { error: { code:
   "unauthenticated", message: "Please log in." } }`.
2. An unknown group id → `404 not_found` (unchanged).
3. A group that exists but has no person linked to this user → `403 { error: { code: "not_a_member", message: "You are
   not a member of this group." } }`.

The token is 32 random bytes as 64 hex characters (`random_bytes`). Only its SHA-256 is stored.

## Seed data

The six groups from epic 1 keep their ids and contents. One new group is created after them (id 7). Accounts are created
deterministically: a fixed password and no `time()` or `rand` in `Seeder.php`. Seeded accounts have no sessions. Every
demo account's password is **`travel-demo-2026`**.

| Account (email) | Linked person on group(s) | "My groups" shows (newest first) |
|---|---|---|
| Ana `ana@example.com` | Ana on 1, Ana on 7 | Madrid weekend `78,30 €`, Lisbon & Porto `1.915,57 €` |
| Ben `ben@example.com` | Ben on 1 | Lisbon & Porto `1.915,57 €` |
| Chloé `chloe@example.com` | Chloé on 1, Chloé on 7 | Madrid weekend `78,30 €`, Lisbon & Porto `1.915,57 €` |
| David `david@example.com` | David on 1 | Lisbon & Porto `1.915,57 €` |
| Eva `eva@example.com` | Eva on 2 | Empty weekend `0,00 €` |
| Hugo `hugo@example.com` | Hugo on 3 | Even split `80,00 €` |
| Jon `jon@example.com` | Jon on 4 | Three-way taxi `10,00 €` |
| Noah `noah@example.com` | Noah on 5 | Great tour of every UNESCO world heritage site in southern Europe by sleeper train `2.345.678,91 €` |
| Olga `olga@example.com` | Olga on 6 | Big group `90,00 €` |

All other people (Finn, Greta, Iris, Kim, Lea, Maximiliane…, Paul, Quinn, Rosa, Sam, Tara) have no account.

**Group 7, "Madrid weekend"**, 2026-09-12 – 2026-09-14, people Ana and Chloé (only):

| Date | Expense | Amount | Recorded by | Paid by | Split |
|---|---|---|---|---|---|
| 2026-09-12 | Tapas at Mercado de San Miguel | `48,30 €` | Chloé | Chloé | equally, Ana and Chloé |
| 2026-09-13 | Prado Museum tickets | `30,00 €` | Ana | Ana | equally, Ana and Chloé |

The summary is a total of `78,30 €` with 2 expenses. Balances: Ana `-9,15 €`, Chloé `+9,15 €`. Transfer: **Ana pays
Chloé `9,15 €`**. After check 14 adds "Churros" `6,00 €` paid by Ana, split equally, the total becomes `84,30 €` with
3 expenses, and the transfer becomes **Ana pays Chloé `6,15 €`**.

These figures were calculated with the current API code (`ExpenseService`, `SummaryService`, `TripRepository::findAll`)
on a fresh in-memory database after the existing seed.

**What each account owes and is owed** (`GET /me/debts`, fresh seed, no seed change; no seeded group is paid):

| Account | "I owe" | "I'm owed" | Transfers that involve them |
|---|---|---|---|
| Ana | `72,90 €` | `0,00 €` | You pay Ben `63,75 €` (Lisbon & Porto); You pay Chloé `9,15 €` (Madrid weekend) |
| Ben | `0,00 €` | `91,40 €` | Ana pays you `63,75 €`, David pays you `27,65 €` (Lisbon & Porto) |
| Chloé | `0,00 €` | `36,22 €` | Ana pays you `9,15 €` (Madrid weekend); David pays you `27,07 €` (Lisbon & Porto) |
| David | `54,72 €` | `0,00 €` | You pay Ben `27,65 €`, You pay Chloé `27,07 €` (Lisbon & Porto) |
| Eva, Hugo | `0,00 €` | `0,00 €` | none: Empty weekend and Even split are settled |
| Jon | `0,00 €` | `6,66 €` | Kim pays you `3,33 €`, Lea pays you `3,33 €` (Three-way taxi) |
| Noah | `0,00 €` | `1.172.839,46 €` | Maximiliane Alexandra von Hohenzollern-Sigmaringen pays you `1.172.839,46 €` (Great tour …) |
| Olga | `0,00 €` | `50,00 €` | Quinn pays you `20,00 €`, Rosa pays you `20,00 €`, Sam pays you `10,00 €` (Big group) |
| Pia | `0,00 €` | `200,00 €` | Inés pays you `100,00 €`, Grandpa pays you `100,00 €` (Ski week) |

The checks change these through the app only:

- Ana marks "Madrid weekend" as paid: Ana "I owe" `63,75 €` (Lisbon & Porto only), Chloé "I'm owed" `27,07 €`.
- Ana creates "Coffee club" (no dates) with Ben (`ben@example.com`); on a fresh seed it is group 9. "Coffee" `10,00 €`
  paid by Ana, split equally between Ana and Ben: **Ben pays Ana `5,00 €`**. Ana: "I owe" `72,90 €`, "I'm owed"
  `5,00 €`. Ben: "I owe" `5,00 €`, "I'm owed" `91,40 €`.

These figures were calculated with the current API code (`SummaryService`, `TripService`, `ExpenseService`,
`TripStatusService`) on a fresh in-memory seeded database.

## Tests

- **PHP (`packages/api/tests`, run through `tests/functional`):**
  - sign-up: success returns a token and the user; a duplicate email (also with different case or spaces) gives
    `taken`; an empty name, a 61-character name, a bad email, a 7-character and a 201-character password each give
    their code; a repeated name is allowed.
  - login: the right password works; a trimmed and uppercased email works; a wrong password and an unknown email both
    give `401 invalid_credentials` with the same message.
  - sessions: a missing or unknown token and an expired session (`expires_at` in the past) give `401 unauthenticated`
    on every group endpoint and on `GET /me`; logout gives `204`, and the same token then gives `401`; the stored value
    is not the token.
  - membership: groups 1–7 each answer `403 not_a_member` to an account that is not on them (e.g. Ben on 7), and
    `404` comes before `403` for `/trips/999`; `GET /trips` lists exactly the groups in the seed table for every demo
    account, in that order; a new account gets `[]`.
  - recorder: a POST with `recorded_by` set to another member saves the logged-in person as recorder; a POST without
    `recorded_by` works.
  - seed: deterministic, and includes the 9 accounts, group 7 and the figures above; `GET /health` answers 200 without a
    token.
  - Existing tests that pass `recorded_by` or call `GET /trips` are updated to the new rules.
  - debts: `GET /me/debts` for every demo account matches the "What each account owes and is owed" table (totals,
    groups in `GET /trips` order, transfers with direction, person and amount); settled groups are left out; marking
    Madrid as paid removes it and lowers Ana's and Chloé's totals; reopening brings them back; Coffee club gives Ana
    both totals at once, not netted; a new account gets zeros and `[]`; `401` without a token.
- **TypeScript (`tests/unit`):** `src/api/session.ts`, which stores, reads and clears the token (with a fake
  `localStorage` and in memory); `src/api/client.ts`, which sends `Authorization: Bearer …` when a token is set and
  none when it is not, and on `401` clears the token and calls the unauthenticated handler, using a fake `fetch`.
  A pure helper for "My groups" (e.g. `src/trips/myGroups.ts`) that, from the two responses and the selected filter,
  returns what to show: open and paid groups split by `paid`, each open card's position (owe, owed or settled, with
  the amount from the API), and the filtered cards; it does no arithmetic on cents. `getDebts` sends `GET /me/debts`
  (fake `fetch`). The new keys exist in en, es and fr.
- **Playwright (`tests/e2e`, 390x844):** a new `login.test.ts` with one screenshot per 📸 check below. The epic 1 suite
  `trip-view.test.ts` logs in as the owner of each fixture group before it opens `?trip=`. Its check 15 records as Jon,
  because Jon is the only account on group 4. Checks 22–31 go in a new `my-groups.test.ts`, which starts on its own
  fresh seed.

## Acceptance checks

Viewport 390x844. Freshly seeded database (`docker compose down -v && docker compose up`). App at
http://localhost:8081. Every demo password is `travel-demo-2026`. Run check 14 last among the checks that use group 7,
because it adds an expense.

1. 📸 **Login screen.** Open `/` with no stored token (a fresh browser profile). The Login screen shows "Travel
   expenses", "Log in to see your groups.", the Email and Password fields, "Log in" as a full-width 56 px button at the
   bottom, and "No account yet? Sign up" under it. No group data is visible.
2. 📸 **My groups, two groups.** Log in as `ana@example.com`. "My groups" shows "Logged in as Ana" and exactly two cards in
   this order: "Madrid weekend", "12 Sep 2026 – 14 Sep 2026", total `78,30 €`; then "Lisbon & Porto", "1 Jun 2026 –
   7 Jun 2026", total `1.915,57 €`. "Log out" is in the menu of the app bar. There is no tab bar.
3. **Open a group.** On Ana's "My groups", tap "Lisbon & Porto". The epic 1 group view opens with "‹ My groups" above the
   name "Lisbon & Porto", the total `1.915,57 €`, and "Ana pays Ben `63,75 €`", "David pays Ben `27,65 €`", "David pays
   Chloé `27,07 €`". The URL is `/?trip=1`. Tap "‹ My groups": the two cards from check 2 are back, and the URL has no
   `?trip=`.
4. 📸 **Madrid group view.** On Ana's "My groups", tap "Madrid weekend". The total shows `78,30 €`, "12 Sep 2026 – 14 Sep
   2026 · 2 expenses", "2 people", and "Who owes whom" shows only "Ana pays Chloé `9,15 €`".
5. **One group only.** Log out, then log in as `ben@example.com`. "My groups" shows "Logged in as Ben" and exactly one
   card, "Lisbon & Porto" `1.915,57 €`. "Madrid weekend" is not listed.
6. 📸 **Not a member.** Logged in as Ben, open `/?trip=7`. The screen shows "You are not a member of this group." and "Go
   to My groups". The network tab shows `GET /trips/7` answered `403`. Tap "Go to My groups": Ben's one-card list from
   check 5, and the URL has no `?trip=`.
7. **Unknown group.** Logged in as Ben, open `/?trip=999`. The screen shows "This group does not exist." and "Go to My
   groups". `/?trip=abc` shows the same, and no request is sent for it.
8. 📸 **Wrong password.** Log out. On Login, enter `ana@example.com` and `wrong-password`, then tap "Log in". The
   owesSoft card shows "Email or password is wrong." The email field still contains `ana@example.com`. With an unknown
   email `nobody@example.com` and any password, the same message appears.
9. **Email typed loosely.** On Login, enter `  ANA@Example.com ` (with spaces) and `travel-demo-2026`. "My groups" opens
   with Ana's two groups.
10. 📸 **Sign-up errors.** Log out. Tap "No account yet? Sign up". Enter name `Zoe`, email `ana@example.com` and password
    `short`, then tap "Create account". "This email already has an account." shows under Email, and "Use at least 8
    characters." shows under Password. The fields keep their values. Clear the name and tap again: "Enter your name."
    shows under the name. Enter `zoe` as the email: "Enter an email like ana@example.com." shows under Email.
11. 📸 **Sign-up, empty list.** On Sign-up enter `Zoe`, `zoe@example.com`, `long-enough-1`, then tap "Create account".
    "My groups" opens with "Logged in as Zoe" and the card "You are not on any group yet. When someone adds you to a group
    with your email, it shows up here." Log out, then log in as `zoe@example.com` / `long-enough-1`: the same empty list.
12. 📸 **Long name and large total in the list.** Log in as `noah@example.com`. One card: the group name "Great tour of
    every UNESCO world heritage site in southern Europe by sleeper train" wraps to at most 2 lines and ends in "…" if it
    does not fit. "1 Apr 2026 – 30 Apr 2026". The total reads `2.345.678,91 €` on one line, right-aligned, and nothing
    scrolls sideways.
13. **Zero total in the list.** Log in as `eva@example.com`. One card: "Empty weekend", "10 Jan 2026 – 12 Jan 2026",
    total `0,00 €`.
14. 📸 **Add expense records as me.** Log in as `ana@example.com`, open "Madrid weekend" and tap "+ Add expense". The
    form has no "Recorded by" section. Enter "Churros", amount `6,00`, paid by Ana, split equally between Ana and Chloé,
    and save. The group view shows the total `84,30 €`, "3 expenses", "Ana pays Chloé `6,15 €`", and the new row "Churros
    `6,00 €`" with "Recorded by Ana". Tap "‹ My groups": Madrid weekend shows `84,30 €`.
15. **Client `recorded_by` is ignored.** Logged in as Ana, in the browser console send `POST /trips/1/expenses` with
    Ana's token, `recorded_by` set to Ben's person id and an otherwise valid body (e.g. "Coffee", `2,00 €` paid by Ana,
    split equally between all four). The response is `201` and `expense.recorded_by.name` is "Ana".
16. **Log out ends the session.** Logged in as Ana, copy the token from `localStorage` (`travel-expenses.token`), then
    tap "Log out" in the menu. Login appears. In the console, `GET /me` with the copied token answers `401` with code
    `unauthenticated`.
17. **Reload keeps me logged in.** Log in as Ana and reload the page. "My groups" appears again without the Login screen.
18. 📸 **Session ended.** Logged in as Ana with "Lisbon & Porto" open, delete the session on the server, either by
    sending `POST /auth/logout` with the same token in the console or by changing the stored token to `x`. Then tap
    "Balances" and reload, or tap "‹ My groups". Login appears with "Your session has ended. Please log in again." After
    logging in, "My groups" opens.
19. **Deep link while logged out.** With no stored token, open `/?trip=1`. Login appears. Log in as `ben@example.com`:
    the "Lisbon & Porto" group view opens directly (`1.915,57 €`).
20. 📸 **API unreachable on Login.** With the API stopped (`docker compose stop api`), log out if needed, then on Login
    enter Ana's email and password and tap "Log in". The card shows "Could not reach the API at http://localhost:8080."
    The button reads "Log in" again and can be tapped. After `docker compose start api`, tapping "Log in" opens Ana's
    "My groups".
21. **Epic 1 still holds.** Logged in as the owner of each fixture group (Eva 2, Hugo 3, Jon 4, Noah 5, Olga 6), the
    epic 1 checks 6–11 show the same figures as before. The `api` container is healthy (`docker compose ps`), because
    the health check uses `GET /health`.
22. 📸 **What I owe, at a glance.** Fresh seed. Log in as `ana@example.com`. Under "Logged in as Ana" the summary
    shows "I owe" `72,90 €` and "I'm owed" `0,00 €`, side by side, each at least 48 px high. The cards are "Madrid
    weekend" with "You owe" `9,15 €` and "Lisbon & Porto" with "You owe" `63,75 €`. There is no "Paid groups" row.
23. 📸 **Paid groups fold away.** As Ana, open "Madrid weekend", tap "Mark as paid" and confirm, then tap "‹ My
    groups". The summary shows "I owe" `63,75 €`. The only card above is "Lisbon & Porto"; below it the row "Paid
    groups (1) ▸" (at least 48 px high) shows no card. Tap it: "Madrid weekend" appears below it with "✓ Paid",
    `78,30 €` and no "You owe" line, and the row reads "Paid groups (1) ▾" (screenshot). Tap the row again: the card
    is hidden. Open "Lisbon & Porto" and tap "‹ My groups": the section is closed again. Open "Madrid weekend" from the
    section, tap "Reopen", then "‹ My groups": "Madrid weekend" is back above "Lisbon & Porto" with "You owe" `9,15 €`,
    "I owe" is `72,90 €`, and there is no "Paid groups" row.
24. 📸 **The "I owe" and "I'm owed" filters.** As Ana, tap "I owe": it shows "✓"; the caption reads "Groups where you
    owe money", followed by "Madrid weekend" with "You pay Chloé" `9,15 €` and "Lisbon & Porto" with "You pay Ben"
    `63,75 €` (screenshot). Tap "I'm owed": "Nobody owes you.". Tap "I'm owed" again: all groups are back. Tap "I owe",
    open "Lisbon & Porto" from the filtered list, and tap "‹ My groups": no filter is selected and all groups show.
25. **Owing and owed at once.** As Ana, tap "+ New group", create "Coffee club" without dates with Ben
    (`ben@example.com`), add "Coffee" `10,00` paid by Ana, split equally between Ana and Ben, and tap "‹ My groups".
    The summary shows "I owe" `72,90 €` and "I'm owed" `5,00 €`; "Coffee club" (after the dated groups) shows "You're
    owed" `5,00 €`. "I'm owed" lists "Coffee club" with "Ben pays you" `5,00 €`. Log in as Ben: "I owe" `5,00 €`,
    "I'm owed" `91,40 €`.
26. **Three people owe me in one group.** Log in as `olga@example.com`. "I'm owed" `50,00 €`. Tap it: "Big group" with
    "Quinn pays you" `20,00 €`, "Rosa pays you" `20,00 €`, "Sam pays you" `10,00 €`.
27. **Uneven cents.** Log in as `jon@example.com`. "I'm owed" `6,66 €`; the filter lists "Three-way taxi" with "Kim
    pays you" `3,33 €` and "Lea pays you" `3,33 €`.
28. **Everyone settled.** Log in as `hugo@example.com`. The summary shows `0,00 €` and `0,00 €`; "Even split" shows
    "Settled". "I owe" shows "You don't owe anyone."; "I'm owed" shows "Nobody owes you.".
29. 📸 **Long name, very large amount.** Log in as `noah@example.com`. "I'm owed" shows `1.172.839,46 €` on one line.
    Tap it: the card for "Great tour of every UNESCO world heritage site in southern Europe by sleeper train" (2 lines,
    "…") has one row "Maximiliane Alexandra von Hohenzollern-Sigmaringen pays you" (at most 2 lines, "…") with
    `1.172.839,46 €` on one line, right-aligned. Nothing scrolls sideways.
30. **No groups, no summary.** Sign up as `yara@example.com` (any name, `long-enough-1`): "My groups" shows the empty
    list card and no "I owe" / "I'm owed".
31. 📸 **API unreachable.** As Ana on "My groups", block the API (`docker compose stop api`, or the e2e suite blocking
    it) and reload: "Could not reach the API at http://localhost:8080." with "Try again". With only `GET /me/debts`
    blocked, the same error shows. Unblock and tap "Try again": the summary and cards from check 22 show. In the
    console, `GET /me/debts` without `Authorization` answers `401` with code `unauthenticated`.

The Playwright suite starts its own seeded API and web export, as in epic 1. Check 20 blocks the API inside the browser,
and check 18 removes the session through the API. Checks 22–31 run in order on their own fresh seed: checks 23 and 25
change Ana's groups. Screenshots go to `test-results/e2e/`.

## Out of scope

From the roadmap: password reset, email verification, social login, creating groups, editing expenses, and roles beyond
"member of the group". Excluded in the rounds: rate limiting or lockout after failed logins, staying logged in on iOS and
Android after the app is closed (no `expo-secure-store`), sliding session expiry, a "Repeat password" field, returning
to the open group after a session ends, linking accounts to group members by email (epic 3), and changing your name,
email or password. For "I owe" / "I'm owed" and the paid section: a net of the two totals, adding up debts per person
across groups, counting debts in paid groups, settling or recording a payment from "My groups", remembering an open
"Paid groups" section or a filter after leaving "My groups", folding away open groups that are settled or whose dates
are past, and new seed data (no seeded group is paid).

## Check on iOS and Android

- The app starts at Login after every cold start, because the token is kept in memory only. Logging in opens "My groups".
- The email field shows the email keyboard with no auto-capital and no autocorrect. The password field hides the text
  and offers the platform password manager without breaking the layout.
- With the keyboard open on Login and Sign-up, the bottom button is still reachable: scroll, or the keyboard does not
  cover the focused field.
- The menu's "Log out" row and the "‹ My groups" text button respond across their full 48 px height, and the app bar
  does not sit under the status bar or notch.
- A long group name on "My groups" wraps to 2 lines with the largest accessibility text size, and `2.345.678,91 €` stays on
  one line.
- The two halves of the "I owe" / "I'm owed" summary and the "Paid groups" row respond across their full height, a
  screen reader announces the selected filter and whether "Paid groups" is expanded, and `1.172.839,46 €` stays on one
  line in a half at the largest accessibility text size.
- `EXPO_PUBLIC_API_URL` on a device points at a reachable host. `localhost` on a phone is the phone itself.
- Both platforms still build: Expo export for `ios` and `android` succeeds in the container.
