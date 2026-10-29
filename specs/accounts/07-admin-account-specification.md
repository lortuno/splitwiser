# Epic 7: Admin account in the seed — specification

Source: new feature (not in `specs/roadmap.md`; closest to epic 2, "Login and my groups"). Brainstorming:
`specs/accounts/07-admin-account-brainstorming.md` (rounds 1–3). Boundaries: `specs/guidelines/architecture.md`,
`specs/guidelines/ui.md`.

## Estimate

Development hours only, as defined in "Estimates" in AGENTS.md. Rows are append-only.

| Date | Task | Estimate (h) | Actual (h) |
|---|---|---|---|
| 2026-10-28 | Build the epic | 0.5 | 0.08 |

## Goal

A fixed local login, `admin@travel.local` / `admin123`, exists in every database, so nobody has to sign up to try the
app. It is an ordinary account with the same rights as everyone else: display name "Admin", English, on no group at
first, so it sees only the groups it creates or is added to. The API creates it at every start when no account has
that email yet, and never changes it afterwards. It is a local demo login, documented in the README; the app does not
show it anywhere. No new package, service or dependency, no schema change and no new endpoint.

## Screens

No new screens. Login, "My groups" and every other screen stay as they are. The admin uses them like any account:

- **Login:** `admin@travel.local` (any case, surrounding spaces ignored, as for every email) and `admin123` log in.
  A wrong password shows the existing "Email or password is wrong.".
- **My groups, empty state:** after the first login the admin sees "Logged in as Admin", the existing empty card "You
  are not on any group yet. Start one with "+ New group", or ask a friend to add you with your email." and "+ New
  group" at the bottom.
- **Sign up:** the admin email is treated like any email that has an account: "Check your email" opens and the email
  "You already have an account" is sent (`specs/accounts/08-security-specification.md`); nothing changes.
- **Loading / error states:** unchanged.

## Data

No schema change. The admin login lives in one constant, `Seeder::ADMIN` (`packages/api/src/Database/Seeder.php`):
display name `Admin`, email `admin@travel.local`, password `admin123`, language `en`.

**Writes:** a new `Seeder::ensureAdmin(): bool` creates the account with `UserRepository::create` (password hashed with
`password_hash`, bcrypt, like the demo accounts), verified like them, when no user has that email, and returns whether it did. It never
updates an existing account: a changed name, language or password stays. It creates no person and no group membership,
so the account is on no group.

**When:** `bin/init-db.php` calls it on every start, after the schema, the seed (`seedIfEmpty`) and the category
backfill, so on a fresh database the 10 demo accounts keep user ids 1–10, the admin gets id 11, and the first group
created after the seed is still group 9. The start log prints one line: "Admin account created: admin@travel.local"
or "Admin account exists, left unchanged.".

`Seeder::ACCOUNTS` (the 10 demo accounts linked to seeded people) does not change; `seedIfEmpty` does not create the
admin, so PHP tests that seed a database get exactly the demo accounts unless they call `ensureAdmin`.

**README:** the demo logins section lists `admin@travel.local` / `admin123` next to the demo accounts, notes that the
admin is on no group, and states that these logins are for the local development database only.

## API

No changes. The admin uses the existing endpoints (`POST /auth/login`, `GET /trips`, `POST /trips`, …) like any
account; there are no roles and no admin-only routes.

## Seed data

No changes to groups, people or expenses. After a fresh start (`init-db`):

- 11 accounts: the 10 demo accounts (ids 1–10, password `travel-demo-2026`) and Admin (id 11, `admin@travel.local`,
  password `admin123`, language `en`), linked to no person.
- The admin's "My groups" is empty. Ana's still lists "Madrid weekend" (`78,30 €`) and "Lisbon & Porto"
  (`1.915,57 €`).
- The group the checks create: "Team lunch", 3 Nov 2026 – 3 Nov 2026, created by the admin with Ana
  (`ana@example.com`) as the second person; it is group 9, with total `0,00 €`. Ana's "My groups" then lists "Team
  lunch" first (newest start date), then "Madrid weekend" and "Lisbon & Porto".

## Tests

- **PHP (`packages/api/tests/AdminAccountTest.php`, run through `tests/functional`):** on a fresh seeded database
  `ensureAdmin` creates the account once (returns `true`, then `false`), with display name, email and language from
  `Seeder::ADMIN`, a bcrypt hash that verifies `admin123`, no linked person and no group; logging in through the API
  works with any case of the email; an existing account with that email (other name and password) is left unchanged
  and `admin123` fails for it; a rename and a language change survive a second `ensureAdmin`; the demo accounts keep
  ids 1–10 and every seeded figure is unchanged; signing up with the admin email answers `202`, sends "You already
  have an account" and leaves the password `admin123`. Existing tests
  still pass.
- **Playwright (`tests/e2e/admin.test.ts`, 390x844):** one screenshot per 📸 check, on a fresh seed, in the order of
  the checks. "Restart" runs `php bin/init-db.php` again against the test database while the API keeps running.

## Acceptance checks

Viewport 390x844. Freshly seeded database (a fresh start of the API). App at http://localhost:8081. The admin
password is `admin123`; every demo password is `travel-demo-2026`. Run the checks in order: checks 4–6 build on each
other.

1. 📸 **Log in as admin.** Open the app, enter `admin@travel.local` and `admin123`, and tap "Log in". "My groups" shows
   "Logged in as Admin", the empty card "You are not on any group yet. Start one with "+ New group", or ask a friend to
   add you with your email." and "+ New group" at the bottom. The menu in the app bar lists "Settings" and "Log out".
2. **Email as typed.** Log out and log in again with `  ADMIN@Travel.local ` and `admin123`: "My groups" for Admin
   appears.
3. **Wrong password and taken email.** Log out. Log in with `admin@travel.local` and `admin1234`: "Email or password is
   wrong." appears. Open "No account yet? Sign up", enter "Someone", `admin@travel.local` and `travel-demo-2026`, and
   tap "Create account": "Check your email" opens as for any email, Mailpit has "You already have an account" for
   `admin@travel.local` and no code, and `admin123` still logs in.
4. 📸 **The admin creates a group with Ana.** Log in as admin, tap "+ New group", enter "Team lunch", start and end date
   `2026-11-03`, and the person "Ana" with the email `ana@example.com`, then tap "Create group". The group view shows
   "Team lunch", `0,00 €`, "3 Nov 2026 – 3 Nov 2026 · 0 expenses" and "2 people"; the address bar shows `?trip=9`.
5. **Ana sees the admin's group.** Log out and log in as `ana@example.com`: "My groups" lists "Team lunch" (`0,00 €`),
   "Madrid weekend" (`78,30 €`) and "Lisbon & Porto" (`1.915,57 €`), in that order. Opening "Team lunch" shows "2
   people".
6. **A restart keeps the admin's changes.** Log in as admin, open "Settings", change the name to "Laura" and tap
   "Save", then choose "Español". Restart the API's start step (`init-db`): its log says "Admin account exists, left
   unchanged.". Reload: the app is in Spanish and "Mis grupos" shows "Sesión iniciada como Laura"; logging in again
   with `admin123` still works.
7. **The start log on a fresh database.** On a fresh database the first start logs "Database created and seeded." and
   "Admin account created: admin@travel.local"; a second start logs "Admin account exists, left unchanged.".
8. **The demo accounts are unchanged.** On a fresh seed, `ana@example.com` logs in with `travel-demo-2026` and sees
   exactly "Madrid weekend" and "Lisbon & Porto"; in the console, `GET /me` with Ana's token answers `id: 1`, and with
   the admin's token `id: 11`, `display_name: "Admin"`, `language: "en"`.
9. **Earlier epics still hold.** With a fresh seed, the epic 1–6 checks pass with the same figures.

## Out of scope

Excluded in the rounds: an admin role or any extra rights, seeing every group, adding the admin to the seeded groups,
an admin among the demo accounts in `ACCOUNTS`, the email `admin@example.com`, creating it only on a fresh database,
resetting its password at start, an environment switch (`SEED_ADMIN`) or a password from the environment
(`ADMIN_PASSWORD`), a login hint on the Login screen, and any screen change. Also not included: changing passwords in
the app, and any use of this database outside local development.

## Check on iOS and Android

- Logging in as `admin@travel.local` works with the email keyboard (no auto-capitalisation of the first letter) and
  the platform password manager does not block the 8-character password.
- Both platforms still build: Expo export for `ios` and `android` succeeds in the container.
