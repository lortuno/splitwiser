# Feature 8: Security — brainstorming

Source: new feature (not in `specs/roadmap.md`). Request: an email verification code at sign-up, 3 failed logins within
2 minutes lock the account for 5 minutes, plus small best-practice security measures. Agreed in the chat before this
file: email is sent with `symfony/mailer` (the first PHP dependency, standalone, no framework) over SMTP set by an
environment DSN, with **Mailpit** as a new local service and image whose inbox the e2e tests read. Both get an entry
under Inventory in `specs/guidelines/architecture.md`.

## What exists today

- **Sign-up** (`POST /auth/signup { display_name, email, password, language }`, spec 02 and 03): creates the account
  and a session at once (`201 { token, user }`), and links every pending `group_invites` row with that email to the
  new account. A taken email answers `422 taken` "This email already has an account.". Passwords: 8 to 200 characters,
  stored with `password_hash`.
- **Login** (`POST /auth/login`): any wrong email or password answers `401 invalid_credentials` "Email or password is
  wrong."; there is no limit on attempts. Spec 02 lists "rate limiting or lockout after failed logins" and "email
  verification" as out of scope.
- **Sessions:** 32 random bytes as a hex token, only its SHA-256 stored, 24 hours, not extended. The web app keeps the
  token in `localStorage`.
- **API headers:** `Access-Control-Allow-Origin: *`, no other security headers. The dev server is `php -S`.
- **Accounts in the seed:** 10 demo accounts and the local admin (`admin@travel.local`), all able to log in.

## Round 1

### Q1. What does the code protect?
- [x] The email address, once: a new account must enter the code from the email before it can be used (Recommended)
- [ ] Also every login (real two-step login: password, then a new code by email each time)
- [ ] Also a login from a device that has not logged in before

### Q2. What happens between sign-up and the code?
- [x] Sign-up creates the account as unverified and sends the code; no session yet. The app shows "Check your email" with a code field. Logging in to an unverified account (right password) sends a fresh code and shows the same screen instead of "My groups" (Recommended)
- [ ] Sign-up logs in at once; a banner asks for the code, and the account is limited until then

### Q3. Code rules
- [ ] 6 digits (`random_int`), stored only as a hash; valid 10 minutes; 5 wrong tries end it; "Send a new code" at most once a minute; a new code replaces the old one (Recommended)
- [x] The same, but valid 15 minutes and 3 tries
- [ ] A link in the email instead of a code

### Q4. Pending invites (a group added this email before the account existed)
Today they are linked at sign-up. Without verification, anyone could sign up with someone else's email and see their
groups.
- [x] Linked only when the code is confirmed (Recommended)
- [ ] Linked at sign-up, as today

### Q5. Sign-up with the email of an account that was never verified
- [x] Allowed: it replaces the unverified account's name, password and language, and sends a new code; a verified email still cannot sign up again (Recommended)
- [ ] Refused until the unverified account is removed (after 24 hours)

### Q6. How are the failed logins counted?
You asked for 3 failures in 2 minutes locking the account for 5 minutes. Counted per email alone, anyone who knows an
address can keep its owner locked out.
- [x] Per email and IP address: 3 failures for an email from one IP within 2 minutes lock that email for that IP for 5 minutes; other IPs can still log in (Recommended)
- [ ] Per email only, exactly as asked: the account is locked for everyone for 5 minutes
- [ ] Per IP only, for every email

### Q7. What a locked login shows
- [x] "Too many attempts. Try again in {minutes} minutes." (`429 locked` with the minutes left), also for the right password, until the lock ends; an unknown email is counted and locked the same way, so the message never shows whether an account exists (Recommended)
- [ ] The usual "Email or password is wrong." until the lock ends

### Q8. Which extra measures go into this feature? (tick the ones you want)
- [x] CORS allows only the app's origin (environment variable), not `*`
- [x] Security headers on every API response: `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`
- [x] A strict Content-Security-Policy on the web app (no inline or remote scripts), because the token is in `localStorage`
- [x] Sign-up no longer tells whether an email has an account: the same answer for a new, unverified or verified email (a verified one gets an email "You already have an account" instead of a code)
- [x] The same limits on sign-up, code checks and "Send a new code" (per IP and per email), so nobody can flood mailboxes or guess codes
- [x] A security log table: sign-ups, verifications, failed logins and locks, with time and IP, never a password or a code
- [x] `composer audit` and `bun audit` run with the tests
- [ ] Passwords of at least 12 characters, and a short bundled list of common passwords refused
- [ ] "Log out everywhere", and every session ends when the password changes

### Q9. Accounts in the seed
- [x] The 10 demo accounts and the admin start verified, so every earlier check still logs in as before (Recommended)
- [ ] The admin starts unverified, to show the flow

- [x] Round 1 answered (tick this when you have answered every question above)

## Round 2

From the chat after Round 1: "Make sure the email is sent in the language chosen in the login screen." Taken from
Round 1: the code is 6 digits, valid 15 minutes, 3 wrong tries end it, a new one at most once a minute.

### Q1. Which language is the email in?
The app language can be picked on Login and Sign-up (epic 6) and is already sent with sign-up.
- [x] The language the app shows when the email is triggered: sign-up, login to an unverified account and "Send a new code" all send `language` (`en`, `es`, `fr`), and the email uses it; on sign-up it is also saved on the account, as today (Recommended)
- [ ] Always the language saved on the account

### Q2. Wireframe: "Check your email" (`VerifyEmailScreen`, new), after "Create account" or a login to an unverified account

```
┌──────────────────────────────────────┐
│                        [English  ▾] │  app bar, languages only
├──────────────────────────────────────┤
│ ‹ Log in                             │  back text button, 48 high
│                                      │
│ Check your email                     │  display 28, bold
│ We sent a 6-digit code to            │  body, inkMuted
│ ana@example.com. It is valid for     │
│ 15 minutes.                          │
│                                      │
│ Code                                 │  caption
│ ┌──────────────────────────────────┐ │  number pad, maxLength 6,
│ │ 123456                           │ │  one-time-code autofill,
│ └──────────────────────────────────┘ │  "Enter" submits
│ This code is wrong. 2 tries left.    │  FieldError
│                                      │
│ Send a new code                      │  text button, 48 high; for
│                                      │  60 s after a send it reads
│                                      │  "Send a new code in 0:42",
│            (flexible space)          │  disabled
│ ┌──────────────────────────────────┐ │
│ │             Confirm              │ │  primary, 56 high, bottom
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```
- [x] Like this; "Confirm" opens "My groups" (with any groups the email was invited to); the code is never filled in or sent by the app on its own (Recommended)
- [ ] Changes (write them under this question)

### Q3. Messages on "Check your email"
- [x] Wrong code: "This code is wrong. {count} tries left." / after the 3rd: "Too many wrong codes. Send a new code." / expired: "This code has expired. Send a new code." / API unreachable: the owesSoft card "Could not reach the API at {url}." / "Send a new code" sent: info line "We sent a new code." (Recommended)
- [ ] One message for every failure: "This code is not valid. Send a new code."

### Q4. Wireframe: the email (plain text, in the language of Q1)

```
From:    Travel expenses <no-reply@travel.local>
Subject: Confirm your email

Hi Ana,

Your code for Travel expenses is:

    123456

It is valid for 15 minutes. If you did not sign up,
you can ignore this email.
```
For an email that already has a verified account (Round 1 Q8), instead:
```
Subject: You already have an account

Hi Ana,

Someone tried to sign up for Travel expenses with this
email. You already have an account: log in with your
password. If it was not you, you can ignore this email.
```
- [x] Like this; the code is not in the subject, so it does not show in notifications on a locked phone (Recommended)
- [ ] The code also in the subject ("123456 is your Travel expenses code")

### Q5. Wireframe: Sign-up and Login (changed)

Sign-up keeps its layout; "This email already has an account." disappears (Round 1 Q8). Login gets the lock message in
its existing owesSoft card:
```
│ ┌──────────────────────────────────┐ │
│ │ Too many attempts. Try again in  │ │  owesSoft card, as for
│ │ 5 minutes.                       │ │  "Email or password is wrong."
│ └──────────────────────────────────┘ │
```
- [x] Like this; the minutes come from the API (1 to 5, rounded up) and the card does not count down on its own (Recommended)
- [ ] The card counts down live and "Log in" is disabled until the lock ends

### Q6. API
- [x] `POST /auth/signup { display_name, email, password, language }` → always `202 { email }` after validation (new, unverified or verified email alike), and the app opens "Check your email"; `POST /auth/verify { email, code }` → `200 { token, user }` or `422` (`code`: `wrong` with `params.tries_left`, `too_many`, `expired`); `POST /auth/resend-code { email, language }` → always `202`, or `429 too_soon` with `params.seconds`; `POST /auth/login { email, password, language }` → for an unverified account with the right password `403 unverified` and a new code is sent; when locked `429 locked` with `params.minutes` (Recommended)
- [ ] The same, but sign-up still answers `201 { token, user }` for a new email and only unverified logins go through the code

### Q7. Limits beyond the login lock (Round 1 Q8, "the same limits on sign-up, code checks and new codes")
- [x] Per IP: at most 10 sign-ups and 20 code checks per hour; per email: at most 5 codes sent per hour (each at least a minute apart); over a limit: `429 too_many_requests` "Too many requests. Try again later." (Recommended)
- [ ] Stricter: 3 sign-ups per IP per hour
- [ ] Only the per-email minute between codes

- [x] Round 2 answered (tick this when you have answered every question above)

## Round 3

### Q1. How do the tests get the emails?
- [ ] PHP tests use an in-memory mailer behind a small `Mailer` interface (no network); the e2e tests send to Mailpit and read the code through Mailpit's HTTP API (`GET /api/v1/messages`); `docker compose` starts Mailpit with the `api` and the test runs (Recommended)
- [x] Mailpit for the PHP tests too

### Q2. Configuration (environment variables, defaults in `docker-compose.yml`)
- [x] `MAILER_DSN` (`smtp://mailpit:1025` locally), `MAIL_FROM` (`Travel expenses <no-reply@travel.local>`), `APP_ORIGIN` (`http://localhost:8081`, the only origin CORS allows); Mailpit's inbox at http://localhost:8025; no secrets in the repository (Recommended)
- [ ] The same, with the values in a committed `.env` file

### Q3. The email cannot be sent (SMTP down)
- [x] Sign-up, login of an unverified account and "Send a new code" save nothing new and answer `503 mail_unavailable`; the screen shows the owesSoft card "We could not send the email. Try again in a moment." and keeps the input (Recommended)
- [ ] Sign-up is saved anyway; the user taps "Send a new code" later

### Q4. Which IP address counts for the limits?
- [x] Only the connection's address (`REMOTE_ADDR`); `X-Forwarded-For` is ignored until a proxy is set up, so it cannot be faked (Recommended)
- [ ] `X-Forwarded-For` when present

### Q5. Testing time-based rules (2-minute window, 5-minute lock, 15-minute code, 1 minute between codes)
- [ ] The API reads the time from an injectable clock; the PHP tests move it forward to check every expiry; the e2e tests check what is visible at once (lock message, countdown, wrong-code tries) without waiting (Recommended)
- [x] Shorter times in the e2e environment, so the browser checks can wait for expiry

### Q6. Accounts that never confirm their email
- [x] Kept as unverified until someone signs up again with that email (Round 1 Q5); no clean-up job (Recommended)
- [ ] Deleted at the next API start when older than 7 days

### Q7. An existing database (`packages/api/var`)
- [x] `users` gets `verified_at`; every account that exists at the next start is marked verified once, so nobody already using the app is locked out; new tables for codes, attempts and the security log are created (Recommended)
- [ ] Existing accounts must verify at their next login

### Q8. Content-Security-Policy on the web app
react-native-web writes its styles inline, so styles need `'unsafe-inline'`; scripts do not.
- [x] A `<meta http-equiv="Content-Security-Policy">` in the web export: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' {API URL}; object-src 'none'; base-uri 'none'; frame-ancestors` left to a server header later (Recommended)
- [ ] No CSP for now

### Q9. Earlier checks that sign up (they keep their numbers and gain the code step)
Spec 02 checks 10, 11 and 30, spec 03 checks 10 and 11, spec 06 check 12 and spec 07's checks sign up. After "Create
account" they now enter the code from the email. Spec 02 check 10 loses "This email already has an account."; spec 03
check 10 shows "Ski week" only after the code (Round 1 Q4).
- [x] Edit those checks in place and untick them in their progress files (Recommended)
- [ ] Leave them and cover sign-up only in this feature's checks

### Q10. Acceptance checks for this feature (untick any you do not want)
- [x] Sign up in French as `lena@example.com`: "Check your email" in French; Mailpit has one French email "Confirmez votre adresse e-mail" with a 6-digit code; the code opens "Mes groupes"
- [x] Wrong code three times: "2 tries left", "1 try left", then "Too many wrong codes. Send a new code."; even the right code is refused until a new one is sent
- [x] "Send a new code": "We sent a new code.", the button reads "Send a new code in 0:59…" and is disabled; the old code no longer works, the new one does
- [x] Sign-up with `ana@example.com`: the same "Check your email" screen; Mailpit has "You already have an account" and no code; Ana's password is unchanged
- [x] Sign-up twice with a new unverified email: the second name and password are the ones that log in after the code
- [x] Login to an unverified account with the right password: a new code arrives and "Check your email" opens; with a wrong password: "Email or password is wrong." and no email
- [x] Invites wait for the code: sign up as `ines@example.com`; before the code, Pia's "Ski week" still shows "Inés"; after the code, "My groups" shows "Ski week"
- [x] Three wrong passwords for `ben@example.com`: the third answers "Too many attempts. Try again in 5 minutes."; the right password then shows the same; `nobody@example.com` locks the same way
- [x] API unreachable and mail down: "Check your email" shows the owesSoft card for each
- [x] Headers: every API response has `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`; `Access-Control-Allow-Origin` is the app's origin, and a request from another origin gets none; the web page's CSP blocks an injected inline script (console)
- [x] Earlier epics still hold: every demo account and the admin log in as before
- [x] PHP only (clock): the lock ends after 5 minutes; failures older than 2 minutes do not count; another IP is not locked; a code expires after 15 minutes; the per-hour limits answer `429 too_many_requests`; the security log has the expected rows and no password or code
- [x] `composer audit` and `bun audit` pass in `bun test`

- [x] Round 3 answered (tick this when you have answered every question above)

## Round 4

Two Round 3 answers change how the tests work, and one Round 3 check still relies on the earlier option. Also: of spec
07, only check 3 signs up (with `admin@travel.local`, today "This email already has an account.").

### Q1. Time-based rules in the tests
Round 3 Q5 picked shorter times in the e2e environment, while the last check of Round 3 Q10 says "PHP only (clock)".
- [x] Both: the four durations are environment variables with the real values as defaults; the e2e run sets short ones and waits in the browser; the PHP tests keep the real durations and move an injectable clock (Recommended)
- [ ] Short durations everywhere: the PHP tests also use the short values and really wait (slower PHP suite, no clock)
- [ ] Only the clock (back to the Round 3 Q5 recommendation): the e2e checks do not wait for expiry

### Q2. The short e2e durations, and what the screens say
The screens say "valid for 15 minutes" and "Try again in {minutes} minutes"; the API sends the minutes, rounded up.
- [x] e2e: code valid 60 s ("valid for 1 minute"), lock 60 s ("Try again in 1 minute"), failure window 120 s (unchanged), 5 s between codes (the button counts "0:05"); the e2e checks for expiry wait up to about a minute each (Recommended)
- [ ] e2e: everything in seconds (code 10 s, lock 10 s, window 20 s, 2 s between codes), and the screens show seconds when a duration is under a minute ("Try again in 10 seconds")

### Q3. Mailpit for the PHP tests (Round 3 Q1)
- [x] The PHP suite sends through `MAILER_DSN` to Mailpit and reads the messages from Mailpit's API (`MAILPIT_URL`, `http://mailpit:8025`); every test reads only the messages to its own unique recipient; `tests/functional` and `tests/e2e` start after Mailpit; if Mailpit is not reachable the suite stops at once with "Mailpit is not running at {url}." (Recommended)
- [ ] The same, but every test empties the whole inbox first (the PHP and e2e suites must then never run at the same time)

### Q4. Spec 07 check 3 (sign-up with the admin's email)
- [x] Edit in place: "Create account" opens "Check your email" as for any email, Mailpit has "You already have an account" for `admin@travel.local`, and the admin password is unchanged; untick it in its progress file (Recommended)
- [ ] Drop the sign-up part of spec 07 check 3

- [x] Round 4 answered (tick this when you have answered every question above)

## Decisions made while writing the specification

- One table, `security_events`, is both the security log and the source of every limit and of the login lock; no
  separate attempts or locks table.
- The limits count per email also for emails without an account, so `too_soon` and the other answers never show
  whether an account exists. "Send a new code" emails only unverified accounts; the "You already have an account"
  email comes only from sign-up.
- Responses that open "Check your email" carry `code_minutes` and `resend_in_seconds`, so the screen texts and the
  countdown follow the configured durations (15 minutes, or 1 minute in the e2e run).
- On login the lock is checked first, then the password, then verification; a wrong password on an unverified account
  counts as a failure like any other.
- `POST /auth/verify` for an email without a pending code answers `expired`, the same as an old code.
- The email texts live in `packages/api` in the three languages; the app gets 13 new keys and loses `error.taken`.
- Check 1 signs up `margot@example.com`, not `lena@example.com`, because spec 06 check 12 already uses Lena.
- Edited elsewhere (and unticked in their progress files): spec 02 checks 10, 11, 30 plus its sign-up screen, API rows,
  tests and out of scope; spec 03 checks 10, 11 plus invite linking at `POST /auth/verify`; spec 06 checks 12, 16 and
  the `error.taken` row; spec 07 check 3, its sign-up line, data and tests.
