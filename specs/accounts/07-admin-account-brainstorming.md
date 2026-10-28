# Admin account in the seed — brainstorming

Source: new feature (not in `specs/roadmap.md`; closest to epic 2, "Login and my trips"). Boundaries:
`specs/guidelines/architecture.md`, `specs/guidelines/ui.md`. Append-only: questions and answers are never changed
once written. Answer by moving the `[x]` or adding a note under the question.

## What exists today (for reference)

- **Accounts:** `users` (display name, email stored lowercased, bcrypt `password_hash`, `language`, timestamps).
  Sign-up needs a name, an email and a password of 8–200 characters, so `admin123` (8 characters) is valid. Login is
  `POST /auth/login`; sessions are bearer tokens. There are **no roles**: every account can do the same things, and
  a trip is visible only to accounts linked to one of its members.
- **Demo accounts:** `Seeder::ACCOUNTS` creates 10 accounts (`ana@example.com` … `pia@example.com`), all with the
  password `travel-demo-2026`, linked to the people on the seeded trips 1–8. Ana sees "Madrid weekend" and "Lisbon &
  Porto", for example.
- **When the seed runs:** `bin/init-db.php` runs at every API start: it applies the schema, then seeds accounts and
  trips **only when the database has no trips** (`seedIfEmpty`), then guesses missing categories. An existing
  database (like yours in `packages/api/var/app.sqlite`) never gets new seed accounts by itself.
- **Checks that rely on the seed:** many earlier checks count trips, people and accounts (e.g. "My trips" for Ana
  shows exactly two trips; the first trip created after the seed is trip 9).
- **Where it runs:** only locally, in Docker; there is no deployment and no environment setting (`APP_ENV`) yet.

---

## Round 1

Functionality and the rules behind it.

### Q1. What is "admin"?
- [x] An ordinary account with a fixed, well-known login (`admin@example.com` / `admin123`), so you can log in without signing up. It has the same rights as every other account; no roles. (Recommended: no new permission model to design, test and secure.)
- [ ] An account with an admin role and extra rights (see Q2), which needs roles in the schema, the API and the checks.

### Q2. What does the admin see after logging in?
- [x] Only its own trips: none at first ("You are not on any trip yet…"), then the ones it creates or is added to by email. The seeded trips and their figures stay untouched. (Recommended)
- [ ] It is added as a member to every seeded trip, so it sees all of them. This changes "4 people" and similar counts, and many earlier checks.
- [ ] It sees every trip in the database through an admin role (needs Q1 option 2).

### Q3. Name and email
- [ ] Display name "Admin", email `admin@example.com`, password `admin123`, language English. (Recommended)
- [x] Display name "Admin", email `admin@travel.local`, password `admin123`.

### Q4. Existing databases
Your current database already has trips, so the seed will not run again.
- [x] At every start, `bin/init-db.php` creates the admin account if no account has its email yet. It never changes an existing account (so a changed name or language stays) and never resets the password. (Recommended)
- [ ] Only a fresh database (`seedIfEmpty`) gets the admin account; existing ones must be reset to get it.

### Q5. How do we keep a well-known password from becoming a risk?
- [x] It stays a local demo login: documented in the README next to the demo accounts, with a clear note that the database is for local development only. No setting to switch it off yet (there is no deployment). (Recommended)
- [ ] Also an environment variable (`SEED_ADMIN=0`) that leaves the admin account out, for any shared setup later.
- [ ] Take the password from an environment variable (`ADMIN_PASSWORD`, default `admin123`).

### Q6. Does the Login screen mention the admin login?
- [x] No: the login is documented in the README only; Login stays as it is. (Recommended: the screen does not advertise a password.)
- [ ] Yes: a small hint under the form, "Demo login: admin@example.com / admin123" (a wireframe follows in the next round).

- [x] Round 1 answered (tick this when you have answered every question above)

## Round 2

Round 1 answers: an ordinary account without extra rights; it sees only its own trips; display name "Admin", email
`admin@travel.local`, password `admin123`, English; created at every start when the email is free, never changed
afterwards; a local demo login documented in the README only; Login stays as it is.

No new screens. Login, "My trips" (its existing empty state) and every other screen stay as they are.

Data, edge cases and the checks.

### Q1. Where is the admin account created?
- [x] A separate step `Seeder::ensureAdmin()`, called by `bin/init-db.php` after the seed on every start, with the login in one constant (`Seeder::ADMIN`). It is not one of the 10 demo accounts in `ACCOUNTS`, is linked to no person and is on no trip, so `SeedTest` ("one account per demo person") and every seeded figure stay as they are. (Recommended)
- [ ] Add it to `ACCOUNTS`, which makes it the 11th demo account (and needs a person named "Admin" on some trip).

### Q2. Order on a fresh database
- [x] The demo accounts and trips are seeded first, then the admin account: the demo accounts keep user ids 1–10, the admin gets the next id, and the first trip created after the seed is still trip 9. (Recommended)
- [ ] Create the admin first, so it is always user 1 (the demo accounts move to ids 2–11).

### Q3. Someone already has the admin email
E.g. a person signed up with `admin@travel.local` before this change, with another password.
- [x] Their account is left exactly as it is (Round 1 Q4), and the start log says "Admin account exists, left unchanged."; `admin123` then does not work for it. A fresh start creates it as "Admin account created: admin@travel.local". (Recommended)
- [ ] Reset that account's password to `admin123` at every start.

### Q4. What do the checks cover?
- [x] On a fresh seed: log in as `admin@travel.local` / `admin123` → "My trips" shows "Logged in as Admin" and the empty state; a wrong password gives the usual "Email or password is wrong."; signing up again with the admin email gives "This email already has an account."; the admin creates a trip with Ana (`ana@example.com`) and Ana sees it; after a rename and a language change, a restart (`init-db` again) keeps them. PHP tests cover: created once, idempotent, never overwritten, hash is bcrypt, not linked to any person, demo figures unchanged. (Recommended)
- [ ] Only the login and the empty state.

- [x] Round 2 answered (tick this when you have answered every question above)

## Round 3

Round 2 answers: every recommendation was kept (`Seeder::ensureAdmin()` called by `init-db` after the seed, admin
after the demo accounts, an existing account with the email left unchanged, the full set of checks).

The screens, confirmed on their own line (the spec checker needs it exactly like this):

No new screens.

### Q1. Confirm that no screen changes
Login, Sign up, "My trips" (with its existing empty state) and Settings are used as they are; the admin login is not
shown anywhere in the app.
- [x] Confirmed: no screen changes. (Recommended)
- [ ] A screen should change (write which one and how below; a wireframe follows in the next round).

- [x] Round 3 answered (tick this when you have answered every question above)
