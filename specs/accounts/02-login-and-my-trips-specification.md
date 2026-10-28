# Epic 2: Login and my trips — specification

Source: `specs/roadmap.md`, epic 2. Brainstorming: `specs/accounts/02-login-and-my-trips-brainstorming.md` (rounds 1–3).
Boundaries: `specs/guidelines/architecture.md`, `specs/guidelines/ui.md`.

## Estimate

Development hours only, as defined in "Estimates" in AGENTS.md. Rows are append-only.

| Date | Task | Estimate (h) | Actual (h) |
|---|---|---|---|
| 2026-10-27 | Build the epic | 1 | 1 |

## Goal

Everyone logs in with their own account. They can sign up (name, email, password) or log in, and then they see "My trips":
only the trips they are a member of, with dates and totals. Tapping a trip opens the epic 1 trip view. Expenses are
recorded as the logged-in person, because the API takes the recorder from the session and the "Recorded by" picker is
gone. Every trip endpoint needs a Bearer token. A trip you are not a member of answers 403. No new package, service or
dependency.

## Screens

### App shell (`App.tsx`)

- **Start-up:** on the web, the app reads the token from `localStorage`. On iOS and Android it keeps the token in memory
  only, so after a restart the app starts at Login. With a token, the app calls `GET /me`. While that request runs, it
  shows the existing centred spinner with "Loading…". `200` leads to "My trips", or to the trip from `?trip=` on the
  web. `401` makes the app forget the token and show Login.
- **Any `401` from any request** while logged in: the app forgets the token and shows Login with the info line "Your
  session has ended. Please log in again." Whatever was on screen is dropped, including an unsaved expense form. After
  logging in again, "My trips" opens.
- **`?trip={id}` (web only):** logged in and a member → that trip view. Logged out → Login first, and after login that
  trip opens. Not a member (`403`) → the "not a member" state. Unknown id (`404`) or an invalid id (no request is sent)
  → "This trip does not exist."
- **API unreachable at start-up:** unchanged. "Could not reach the API at {url}." and "Try again".
- **Not-found state (changed):** "This trip does not exist." The button now reads **"Go to My trips"** (was "Open the
  demo trip"). It removes `?trip=` from the URL and opens "My trips".
- **Not-a-member state (new):** "You are not a member of this trip." and a **"Go to My trips"** button (accent, at least
  48 px high), centred like the not-found state. Tapping it does the same as the not-found button.

```
┌──────────────────────────────────────┐
│                                      │
│   You are not a member of this trip. │  centred
│        ┌────────────────────┐        │
│        │   Go to My trips   │        │  accent button, 48 high
│        └────────────────────┘        │
│                                      │
└──────────────────────────────────────┘
```

### Login (`LoginScreen`, new)

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

- **Log in** (`size.tapPrimary`, bottom): sends `POST /auth/login` with the email and password exactly as typed (the
  API trims the email and lowercases it). While the request runs, the button reads "Logging in…" and is disabled. On
  success the app stores the token and opens "My trips", or the pending `?trip=` trip.
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
  disabled. `201` → token stored, "My trips" opens (empty for a new account). `422` → the API message for each field
  appears under that field (`FieldError`), and the form keeps its values. The API is unreachable → the error card from
  Login above the button.
- Email field: `email-address` keyboard, no autocapitalise, no autocorrect. Password: `secureTextEntry`.

### My trips (`MyTripsScreen`, new)

```
┌──────────────────────────────────────┐
│ My trips                    Log out  │  header: title 20 bold;
├──────────────────────────────────────┤  "Log out" text button, 48 high
│ Logged in as Ana                     │  caption, inkMuted
│ ┌──────────────────────────────────┐ │
│ │ Madrid weekend                   │ │  one card per trip, whole card
│ │ 12 Sep 2026 – 14 Sep 2026        │ │  is a button (≥ 48 high);
│ │ Total                    78,30 € │ │  name: body bold, 2 lines max
│ └──────────────────────────────────┘ │  with "…"; dates: caption;
│ ┌──────────────────────────────────┐ │  total: Money, right aligned
│ │ Lisbon & Porto                   │ │
│ │ 1 Jun 2026 – 7 Jun 2026          │ │
│ │ Total                 1.915,57 € │ │  newest start date first
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

- **Data:** `GET /trips` (only this user's trips, newest start date first). The name in "Logged in as {name}" comes
  from `GET /me`, or from the login or sign-up response.
- **Dates:** same format as the trip view (`1 Jun 2026 – 7 Jun 2026`). **Total:** the full amount
  (`formatCents`, e.g. `2.345.678,91 €`) on one line, right-aligned. The trip name wraps to at most 2 lines and ends in
  "…".
- **Tap a card:** opens the trip view for that trip on the Trip tab. On the web the URL becomes `?trip={id}`.
- **Log out** (`size.tapMin`): `POST /auth/logout`, then the app forgets the token and shows Login. If the request fails
  (unreachable or `401`), the app still forgets the token and shows Login.
- **Empty state:** a card "You are not on any trip yet. When someone adds you to a trip with your email, it shows up
  here."
- **Loading:** the centred spinner with "Loading…". **Error:** "Could not reach the API at {url}." with "Try again",
  centred, as in the app shell.
- No tab bar and no "New trip" action (creating trips is epic 3).

### Trip view header (changed)

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

- **‹ My trips** (`size.tapMin`, on its own line): back to "My trips", which loads again so the totals are up to date.
  On the web, `?trip=` is removed from the URL.
- The trip view, the Balances tab and the tab bar are unchanged from epic 1.

### Add expense (`AddExpenseScreen`, changed)

- The **"Recorded by"** section and its error are removed. Nothing replaces them. The request no longer sends
  `recorded_by`. Amounts still use `decimal-pad` / `inputMode="decimal"`.
- After saving, the trip view updates from the returned summary, as in epic 1. The new row reads "Recorded by {name of
  the logged-in person on this trip}".

## Data

**Schema changes** (`packages/api/src/Database/Schema.php`):

- New table `users`: `id INTEGER PRIMARY KEY`, `name TEXT NOT NULL`, `email TEXT NOT NULL UNIQUE` (trimmed, lowercase),
  `password_hash TEXT NOT NULL` (`password_hash(..., PASSWORD_DEFAULT)`), `created_at TEXT NOT NULL DEFAULT
  CURRENT_TIMESTAMP`.
- New table `sessions`: `token_hash TEXT PRIMARY KEY` (SHA-256 hex of the token, never the token itself), `user_id
  INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE`, `created_at TEXT NOT NULL`, `expires_at TEXT NOT NULL`
  (24 hours after login or sign-up, not extended). Index on `user_id`.
- `people` gets `user_id INTEGER NULL REFERENCES users (id)`, with an index. One account is linked to at most one person
  row per trip. The API enforces this, and the seed is the only writer in this epic.
- Membership: a user is a member of a trip when one of the trip's `trip_members` people has `people.user_id = user`.
- An existing dev database has no `users` table, and it already has trips, so the seed would not run again. Reset it
  once with `docker compose down -v`. Dev data only, no migration.

**Writes:** sign-up inserts a user and a session. Login inserts a session. Logout deletes its session.
`POST /trips/{id}/expenses` writes `recorded_by` = the logged-in user's person on that trip.
**Reads:** the session by token hash (an expired session counts as missing), the user, and that user's trips with
`total_cents` from `v_trip_totals`.
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
| `GET /trips` | `200 [{ id, name, start_date, end_date, total_cents }]`. Only trips the user is a member of, `start_date` desc, `id` desc. `[]` when there are none. |
| `GET /trips/{id}` | Unchanged shape. |
| `GET /trips/{id}/expenses` | Unchanged shape. |
| `GET /trips/{id}/summary` | Unchanged shape. |
| `POST /trips/{id}/expenses` (and `?dry_run=1`) | Unchanged shape. `recorded_by` in the body is ignored. The recorder is the user's person on the trip. The `recorded_by` validation error no longer exists. |

Errors for all endpoints that need a token, checked in this order:

1. No `Authorization` header, a token that is not a session, or an expired session → `401 { error: { code:
   "unauthenticated", message: "Please log in." } }`.
2. An unknown trip id → `404 not_found` (unchanged).
3. A trip that exists but has no person linked to this user → `403 { error: { code: "not_a_member", message: "You are
   not a member of this trip." } }`.

The token is 32 random bytes as 64 hex characters (`random_bytes`). Only its SHA-256 is stored.

## Seed data

The six trips from epic 1 keep their ids and contents. One new trip is created after them (id 7). Accounts are created
deterministically: a fixed password and no `time()` or `rand` in `Seeder.php`. Seeded accounts have no sessions. Every
demo account's password is **`travel-demo-2026`**.

| Account (email) | Linked person on trip(s) | "My trips" shows (newest first) |
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

**Trip 7, "Madrid weekend"**, 2026-09-12 – 2026-09-14, people Ana and Chloé (only):

| Date | Expense | Amount | Recorded by | Paid by | Split |
|---|---|---|---|---|---|
| 2026-09-12 | Tapas at Mercado de San Miguel | `48,30 €` | Chloé | Chloé | equally, Ana and Chloé |
| 2026-09-13 | Prado Museum tickets | `30,00 €` | Ana | Ana | equally, Ana and Chloé |

The summary is a total of `78,30 €` with 2 expenses. Balances: Ana `-9,15 €`, Chloé `+9,15 €`. Transfer: **Ana pays
Chloé `9,15 €`**. After check 14 adds "Churros" `6,00 €` paid by Ana, split equally, the total becomes `84,30 €` with
3 expenses, and the transfer becomes **Ana pays Chloé `6,15 €`**.

These figures were calculated with the current API code (`ExpenseService`, `SummaryService`, `TripRepository::findAll`)
on a fresh in-memory database after the existing seed.

## Tests

- **PHP (`packages/api/tests`, run through `tests/functional`):**
  - sign-up: success returns a token and the user; a duplicate email (also with different case or spaces) gives
    `taken`; an empty name, a 61-character name, a bad email, a 7-character and a 201-character password each give
    their code; a repeated name is allowed.
  - login: the right password works; a trimmed and uppercased email works; a wrong password and an unknown email both
    give `401 invalid_credentials` with the same message.
  - sessions: a missing or unknown token and an expired session (`expires_at` in the past) give `401 unauthenticated`
    on every trip endpoint and on `GET /me`; logout gives `204`, and the same token then gives `401`; the stored value
    is not the token.
  - membership: trips 1–7 each answer `403 not_a_member` to an account that is not on them (e.g. Ben on 7), and
    `404` comes before `403` for `/trips/999`; `GET /trips` lists exactly the trips in the seed table for every demo
    account, in that order; a new account gets `[]`.
  - recorder: a POST with `recorded_by` set to another member saves the logged-in person as recorder; a POST without
    `recorded_by` works.
  - seed: deterministic, and includes the 9 accounts, trip 7 and the figures above; `GET /health` answers 200 without a
    token.
  - Existing tests that pass `recorded_by` or call `GET /trips` are updated to the new rules.
- **TypeScript (`tests/unit`):** `src/api/session.ts`, which stores, reads and clears the token (with a fake
  `localStorage` and in memory); `src/api/client.ts`, which sends `Authorization: Bearer …` when a token is set and
  none when it is not, and on `401` clears the token and calls the unauthenticated handler, using a fake `fetch`.
- **Playwright (`tests/e2e`, 390x844):** a new `login.test.ts` with one screenshot per 📸 check below. The epic 1 suite
  `trip-view.test.ts` logs in as the owner of each fixture trip before it opens `?trip=`. Its check 15 records as Jon,
  because Jon is the only account on trip 4.

## Acceptance checks

Viewport 390x844. Freshly seeded database (`docker compose down -v && docker compose up`). App at
http://localhost:8081. Every demo password is `travel-demo-2026`. Run check 14 last among the checks that use trip 7,
because it adds an expense.

1. 📸 **Login screen.** Open `/` with no stored token (a fresh browser profile). The Login screen shows "Travel
   expenses", "Log in to see your trips.", the Email and Password fields, "Log in" as a full-width 56 px button at the
   bottom, and "No account yet? Sign up" under it. No trip data is visible.
2. 📸 **My trips, two trips.** Log in as `ana@example.com`. "My trips" shows "Logged in as Ana" and exactly two cards in
   this order: "Madrid weekend", "12 Sep 2026 – 14 Sep 2026", total `78,30 €`; then "Lisbon & Porto", "1 Jun 2026 –
   7 Jun 2026", total `1.915,57 €`. "Log out" is in the header. There is no tab bar.
3. **Open a trip.** On Ana's "My trips", tap "Lisbon & Porto". The epic 1 trip view opens with "‹ My trips" above the
   name "Lisbon & Porto", the total `1.915,57 €`, and "Ana pays Ben `63,75 €`", "David pays Ben `27,65 €`", "David pays
   Chloé `27,07 €`". The URL is `/?trip=1`. Tap "‹ My trips": the two cards from check 2 are back, and the URL has no
   `?trip=`.
4. 📸 **Madrid trip view.** On Ana's "My trips", tap "Madrid weekend". The total shows `78,30 €`, "12 Sep 2026 – 14 Sep
   2026 · 2 expenses", "2 people", and "Who owes whom" shows only "Ana pays Chloé `9,15 €`".
5. **One trip only.** Log out, then log in as `ben@example.com`. "My trips" shows "Logged in as Ben" and exactly one
   card, "Lisbon & Porto" `1.915,57 €`. "Madrid weekend" is not listed.
6. 📸 **Not a member.** Logged in as Ben, open `/?trip=7`. The screen shows "You are not a member of this trip." and "Go
   to My trips". The network tab shows `GET /trips/7` answered `403`. Tap "Go to My trips": Ben's one-card list from
   check 5, and the URL has no `?trip=`.
7. **Unknown trip.** Logged in as Ben, open `/?trip=999`. The screen shows "This trip does not exist." and "Go to My
   trips". `/?trip=abc` shows the same, and no request is sent for it.
8. 📸 **Wrong password.** Log out. On Login, enter `ana@example.com` and `wrong-password`, then tap "Log in". The
   owesSoft card shows "Email or password is wrong." The email field still contains `ana@example.com`. With an unknown
   email `nobody@example.com` and any password, the same message appears.
9. **Email typed loosely.** On Login, enter `  ANA@Example.com ` (with spaces) and `travel-demo-2026`. "My trips" opens
   with Ana's two trips.
10. 📸 **Sign-up errors.** Log out. Tap "No account yet? Sign up". Enter name `Zoe`, email `ana@example.com` and password
    `short`, then tap "Create account". "This email already has an account." shows under Email, and "Use at least 8
    characters." shows under Password. The fields keep their values. Clear the name and tap again: "Enter your name."
    shows under the name. Enter `zoe` as the email: "Enter an email like ana@example.com." shows under Email.
11. 📸 **Sign-up, empty list.** On Sign-up enter `Zoe`, `zoe@example.com`, `long-enough-1`, then tap "Create account".
    "My trips" opens with "Logged in as Zoe" and the card "You are not on any trip yet. When someone adds you to a trip
    with your email, it shows up here." Log out, then log in as `zoe@example.com` / `long-enough-1`: the same empty list.
12. 📸 **Long name and large total in the list.** Log in as `noah@example.com`. One card: the trip name "Great tour of
    every UNESCO world heritage site in southern Europe by sleeper train" wraps to at most 2 lines and ends in "…" if it
    does not fit. "1 Apr 2026 – 30 Apr 2026". The total reads `2.345.678,91 €` on one line, right-aligned, and nothing
    scrolls sideways.
13. **Zero total in the list.** Log in as `eva@example.com`. One card: "Empty weekend", "10 Jan 2026 – 12 Jan 2026",
    total `0,00 €`.
14. 📸 **Add expense records as me.** Log in as `ana@example.com`, open "Madrid weekend" and tap "+ Add expense". The
    form has no "Recorded by" section. Enter "Churros", amount `6,00`, paid by Ana, split equally between Ana and Chloé,
    and save. The trip view shows the total `84,30 €`, "3 expenses", "Ana pays Chloé `6,15 €`", and the new row "Churros
    `6,00 €`" with "Recorded by Ana". Tap "‹ My trips": Madrid weekend shows `84,30 €`.
15. **Client `recorded_by` is ignored.** Logged in as Ana, in the browser console send `POST /trips/1/expenses` with
    Ana's token, `recorded_by` set to Ben's person id and an otherwise valid body (e.g. "Coffee", `2,00 €` paid by Ana,
    split equally between all four). The response is `201` and `expense.recorded_by.name` is "Ana".
16. **Log out ends the session.** Logged in as Ana, copy the token from `localStorage` (`travel-expenses.token`), then
    tap "Log out". Login appears. In the console, `GET /me` with the copied token answers `401` with code
    `unauthenticated`.
17. **Reload keeps me logged in.** Log in as Ana and reload the page. "My trips" appears again without the Login screen.
18. 📸 **Session ended.** Logged in as Ana with "Lisbon & Porto" open, delete the session on the server, either by
    sending `POST /auth/logout` with the same token in the console or by changing the stored token to `x`. Then tap
    "Balances" and reload, or tap "‹ My trips". Login appears with "Your session has ended. Please log in again." After
    logging in, "My trips" opens.
19. **Deep link while logged out.** With no stored token, open `/?trip=1`. Login appears. Log in as `ben@example.com`:
    the "Lisbon & Porto" trip view opens directly (`1.915,57 €`).
20. 📸 **API unreachable on Login.** With the API stopped (`docker compose stop api`), log out if needed, then on Login
    enter Ana's email and password and tap "Log in". The card shows "Could not reach the API at http://localhost:8080."
    The button reads "Log in" again and can be tapped. After `docker compose start api`, tapping "Log in" opens Ana's
    "My trips".
21. **Epic 1 still holds.** Logged in as the owner of each fixture trip (Eva 2, Hugo 3, Jon 4, Noah 5, Olga 6), the
    epic 1 checks 6–11 show the same figures as before. The `api` container is healthy (`docker compose ps`), because
    the health check uses `GET /health`.

The Playwright suite starts its own seeded API and web export, as in epic 1. Check 20 blocks the API inside the browser,
and check 18 removes the session through the API. Screenshots go to `test-results/e2e/`.

## Out of scope

From the roadmap: password reset, email verification, social login, creating trips, editing expenses, and roles beyond
"member of the trip". Excluded in the rounds: rate limiting or lockout after failed logins, staying logged in on iOS and
Android after the app is closed (no `expo-secure-store`), sliding session expiry, a "Repeat password" field, returning
to the open trip after a session ends, linking accounts to trip members by email (epic 3), and changing your name,
email or password.

## Check on iOS and Android

- The app starts at Login after every cold start, because the token is kept in memory only. Logging in opens "My trips".
- The email field shows the email keyboard with no auto-capital and no autocorrect. The password field hides the text
  and offers the platform password manager without breaking the layout.
- With the keyboard open on Login and Sign-up, the bottom button is still reachable: scroll, or the keyboard does not
  cover the focused field.
- The "Log out" and "‹ My trips" text buttons respond across their full 48 px height, and the header does not sit under
  the status bar or notch.
- A long trip name on "My trips" wraps to 2 lines with the largest accessibility text size, and `2.345.678,91 €` stays on
  one line.
- `EXPO_PUBLIC_API_URL` on a device points at a reachable host. `localhost` on a phone is the phone itself.
- Both platforms still build: Expo export for `ios` and `android` succeeds in the container.
