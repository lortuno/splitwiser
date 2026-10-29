# Feature 8: Security — specification

Source: new feature (not in `specs/roadmap.md`). Brainstorming: `specs/accounts/08-security-brainstorming.md` (rounds
1–4). Boundaries: `specs/guidelines/architecture.md`, `specs/guidelines/ui.md`.

## Estimate

Development hours only, as defined in "Estimates" in AGENTS.md. Rows are append-only.

| Date | Task | Estimate (h) | Actual (h) |
|---|---|---|---|
| 2026-10-29 | Build the feature | 1.5 | 1 |
| 2026-10-29 | Build spec change: documented, time-limited audit exception | 0.25 | 0.08 |

## Goal

A new account proves it owns its email: sign-up sends a 6-digit code by email, in the language the app shows, and the
account can only be used once the code is entered. Groups that invited that email are linked only then. Login is
protected against guessing: 3 failed attempts for an email from one address within 2 minutes lock that email for that
address for 5 minutes, with the same answer whether the account exists or not. Sign-up never tells whether an email
has an account. Small best-practice measures come with it: CORS limited to the app's origin, security headers on every
API response, a Content-Security-Policy on the web app, limits on sign-ups, code checks and emails, a security log,
and dependency audits in the test run. Email is sent with `symfony/mailer` (the first PHP dependency, standalone, no
framework) over SMTP, with **Mailpit** as the local mail server and inbox; both get an entry under Inventory in
`specs/guidelines/architecture.md` in the commit that adds them.

## Screens

All buttons are at least `size.tapMin` (48 px) high; primary buttons are `size.tapPrimary` (56 px) and sit at the bottom.
Every new text exists in English, Spanish and French (see the table at the end of this section).

### Check your email (`VerifyEmailScreen`, new)

Opens after "Create account" (`202`) and after a login to an unverified account (`403 unverified`).

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
│                                      │  the wait after a send it reads
│                                      │  "Send a new code in 0:42",
│            (flexible space)          │  disabled
│ ┌──────────────────────────────────┐ │
│ │             Confirm              │ │  primary, 56 high, bottom
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

- **Intro:** "We sent a 6-digit code to {email}. It is valid for {minutes} minutes." (`verify.intro`, "1 minute" with
  `.one`). `{email}` is the email as typed; `{minutes}` is `code_minutes` from the API.
- **Code field:** `keyboardType="number-pad"`, `textContentType="oneTimeCode"`, `autoComplete="one-time-code"`,
  `maxLength` 6. The app never fills in or sends the code on its own; "Enter" in the field does the same as "Confirm".
- **Confirm** (`size.tapPrimary`): `POST /auth/verify { email, code }`. While it runs: "Confirming…", disabled.
  - `200` → the token is stored and "My groups" opens, with every group the email was invited to.
  - `422 code` → under the field: `wrong` "This code is wrong. {count} tries left." (`.one`: "1 try left"),
    `too_many` "Too many wrong codes. Send a new code.", `expired` "This code has expired. Send a new code.". The
    field keeps its value.
  - `429 too_many_requests` → the owesSoft card "Too many requests. Try again later.".
  - API unreachable → the owesSoft card "Could not reach the API at {url}.". The input stays.
- **Send a new code** (text button, `size.tapMin`): `POST /auth/resend-code { email, language }`. `202` → the info line
  (caption, `inkMuted`) "We sent a new code." above the field, the field is emptied, and the button reads "Send a new
  code in {m:ss}", disabled, counting down `resend_in_seconds` from the response, then "Send a new code" again. The
  countdown also starts when the screen opens, from the sign-up or login response. `429 too_soon` → the countdown from
  `params.seconds`, no message. `429 too_many_requests` and `503 mail_unavailable` → the owesSoft card with their text.
- **‹ Log in:** back to Login, without asking. The account stays unverified; logging in with the right password later
  sends a new code and opens this screen again.
- **Loading / empty:** none; the screen needs only the email and the numbers from the response that opened it.

### Sign-up (`SignUpScreen`, changed)

The layout is unchanged. "This email already has an account." no longer exists. **Create account** sends
`POST /auth/signup { display_name, email, password, language }` with the language the app shows.

- `202` → "Check your email" opens for that email, for a new, an unverified and a verified email alike.
- `422` → field errors as before (`required`, `too_long`, `invalid_email`, `too_short`).
- `429 too_many_requests` / `503 mail_unavailable` / API unreachable → the owesSoft card above the button with "Too many
  requests. Try again later." / "We could not send the email. Try again in a moment." / "Could not reach the API at
  {url}."; the input stays.

### Login (`LoginScreen`, changed)

The layout is unchanged. **Log in** sends `POST /auth/login { email, password, language }` with the language the app
shows.

- `403 unverified` → "Check your email" opens for that email (a new code was sent).
- `429 locked` → the owesSoft card "Too many attempts. Try again in {minutes} minutes." (`.one`: "1 minute"), the
  minutes from `params.minutes`. The card does not count down on its own; "Log in" can be tapped again.
- `429 too_many_requests` / `503 mail_unavailable` → the owesSoft card with their text.

```
│ ┌──────────────────────────────────┐ │
│ │ Too many attempts. Try again in  │ │  owesSoft card, as for
│ │ 5 minutes.                       │ │  "Email or password is wrong."
│ └──────────────────────────────────┘ │
```

### The emails (plain text, sent by the API)

In the language sent with the request that triggered them (`language`, `en` when missing). `{name}` is the display
name the account will have (sign-up) or has (login, resend, already registered). `{minutes}` is the code's validity.

```
From:    Travel expenses <no-reply@travel.local>
Subject: Confirm your email

Hi {name},

Your code for Travel expenses is:

    123456

It is valid for {minutes} minutes. If you did not sign up,
you can ignore this email.
```

```
Subject: You already have an account

Hi {name},

Someone tried to sign up for Travel expenses with this
email. You already have an account: log in with your
password. If it was not you, you can ignore this email.
```

| Text | English | Español | Français |
|---|---|---|---|
| Code subject | Confirm your email | Confirma tu correo | Confirmez votre adresse e-mail |
| Code body | Hi {name}, / Your code for Travel expenses is: / It is valid for {minutes} minutes. If you did not sign up, you can ignore this email. | Hola {name}: / Tu código para Gastos de viaje es: / Es válido durante {minutes} minutos. Si no te has registrado, puedes ignorar este correo. | Bonjour {name}, / Votre code pour Frais de voyage est : / Il est valable {minutes} minutes. Si vous ne vous êtes pas inscrit, vous pouvez ignorer cet e-mail. |
| Already subject | You already have an account | Ya tienes una cuenta | Vous avez déjà un compte |
| Already body | Hi {name}, / Someone tried to sign up for Travel expenses with this email. You already have an account: log in with your password. If it was not you, you can ignore this email. | Hola {name}: / Alguien ha intentado registrarse en Gastos de viaje con este correo. Ya tienes una cuenta: inicia sesión con tu contraseña. Si no has sido tú, puedes ignorar este correo. | Bonjour {name}, / Quelqu’un a essayé de s’inscrire à Frais de voyage avec cette adresse. Vous avez déjà un compte : connectez-vous avec votre mot de passe. Si ce n’était pas vous, vous pouvez ignorer cet e-mail. |

With 1 minute the bodies say "1 minute" / "1 minuto" / "1 minute". The email texts live in `packages/api` (they are
not app texts).

### New app texts

| Key | English | Español | Français |
|---|---|---|---|
| `verify.title` | Check your email | Revisa tu correo | Consultez vos e-mails |
| `verify.intro` / `.one` | We sent a 6-digit code to {email}. It is valid for {minutes} minutes. / … for 1 minute. | Hemos enviado un código de 6 cifras a {email}. Es válido durante {minutes} minutos. / … 1 minuto. | Nous avons envoyé un code à 6 chiffres à {email}. Il est valable {minutes} minutes. / … 1 minute. |
| `verify.code` | Code | Código | Code |
| `verify.confirm` / `verify.confirming` | Confirm / Confirming… | Confirmar / Confirmando… | Confirmer / Confirmation… |
| `verify.resend` / `verify.resendIn` | Send a new code / Send a new code in {time} | Enviar un código nuevo / Enviar un código nuevo en {time} | Envoyer un nouveau code / Envoyer un nouveau code dans {time} |
| `verify.resent` | We sent a new code. | Hemos enviado un código nuevo. | Nous avons envoyé un nouveau code. |
| `error.codeWrong` / `.one` | This code is wrong. {count} tries left. / … 1 try left. | Este código no es correcto. Quedan {count} intentos. / Queda 1 intento. | Ce code est incorrect. Il reste {count} essais. / Il reste 1 essai. |
| `error.codeTooMany` | Too many wrong codes. Send a new code. | Demasiados códigos incorrectos. Pide un código nuevo. | Trop de codes incorrects. Demandez un nouveau code. |
| `error.codeExpired` | This code has expired. Send a new code. | Este código ha caducado. Pide un código nuevo. | Ce code a expiré. Demandez un nouveau code. |
| `auth.locked` / `.one` | Too many attempts. Try again in {minutes} minutes. / … in 1 minute. | Demasiados intentos. Inténtalo de nuevo en {minutes} minutos. / … en 1 minuto. | Trop de tentatives. Réessayez dans {minutes} minutes. / … dans 1 minute. |
| `error.tooManyRequests` | Too many requests. Try again later. | Demasiadas solicitudes. Inténtalo más tarde. | Trop de demandes. Réessayez plus tard. |
| `error.mailUnavailable` | We could not send the email. Try again in a moment. | No pudimos enviar el correo. Inténtalo de nuevo en un momento. | Nous n’avons pas pu envoyer l’e-mail. Réessayez dans un instant. |

`error.taken` ("This email already has an account.") is removed in all three languages.

## Data

**Schema changes** (`packages/api/src/Database/Schema.php`):

- `users` gets **`verified_at TEXT NULL`** (`ADDED_COLUMNS`). When the column is added to an existing database, every
  account in it gets `verified_at` = the time of that start, once, so nobody already using the app is locked out. New
  accounts start with `NULL`. Only verified accounts can log in.
- New table **`email_codes`**: `user_id INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE`, `code_hash TEXT
  NOT NULL` (SHA-256 of the code), `tries_left INTEGER NOT NULL` (starts at 3), `expires_at TEXT NOT NULL`. One row
  per unverified account; a new code replaces it; confirming deletes it.
- New table **`security_events`**: `id INTEGER PRIMARY KEY`, `event TEXT NOT NULL CHECK (event IN ('signup',
  'code_sent', 'already_registered_sent', 'code_checked', 'verified', 'login', 'login_failed', 'locked'))`, `email
  TEXT NULL` (trimmed, lowercased, as typed even when no account has it), `ip TEXT NOT NULL`, `at TEXT NOT NULL`.
  Indexes on `(email, event, at)` and `(ip, event, at)`. It is both the security log and the source of every limit.
  It never holds a password, a code or a token.

**Rules** (all times from an injectable clock, `App\Clock`; durations from the environment, see API):

- **Code:** 6 digits from `random_int(0, 999999)`, zero-padded, stored only as its SHA-256. Valid `AUTH_CODE_TTL`
  (900 s); 3 wrong tries end it.
- **Codes sent per email:** at least `AUTH_RESEND_GAP` (60 s) apart and at most 5 per hour, counting `code_sent` and
  `already_registered_sent` events for that email. They are counted for every email, also one without an account, so
  the answers never show whether an account exists.
- **Login lock**, per email and IP: a failure is a login whose email is unknown, whose password is wrong, or whose
  account is unverified with a wrong password. When the 3rd failure for the same email and IP falls within
  `AUTH_FAILURE_WINDOW` (120 s), a `locked` event is written, and for `AUTH_LOCK` (300 s) after it every login for that
  email from that IP answers `429 locked` without checking the password and without counting. Failures before the end
  of a lock do not count towards the next one. Other IPs are not affected.
- **Per IP:** at most 10 `signup` and 20 `code_checked` events per hour.
- **IP:** only `REMOTE_ADDR`; `X-Forwarded-For` is ignored.

**Writes:**

- **Sign-up** (one transaction, rolled back with nothing saved if the email cannot be sent): a `signup` event. New
  email → an unverified user (`display_name`, `password_hash`, `language`) and a code, emailed. Unverified email → its
  name, password and language are replaced and a new code is emailed. Verified email → nothing changes, the "already"
  email is sent. If the email's sending limit is reached, nothing is sent and the answer is still `202`. No session and
  no invite linking.
- **Verify:** a `code_checked` event; right code → `verified_at` set, the code deleted, every `group_invites` row with
  that email linked (as sign-up did before), a session created, a `verified` event; wrong → `tries_left` − 1.
- **Login:** `login` or `login_failed` (and `locked` when the 3rd failure lands); an unverified account with the right
  password gets a new code by email (within the sending limits), no session.
- **Resend:** a new code for an unverified account (an `already` email for a verified one is not sent here; an unknown
  or verified email gets nothing), always counted as `code_sent` for the email.

**App:** `src/api/auth.ts` gets `verifyCode` and `resendCode`; `signUp` returns `{ email, code_minutes,
resend_in_seconds }` instead of a user and stores no token; `logIn` sends `language`. The countdown on "Check your
email" is the only timer and counts seconds, not money.

## API

Every response gets `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store`.
CORS: `Access-Control-Allow-Origin` is `APP_ORIGIN` when the request's `Origin` equals it and is left out otherwise,
with `Vary: Origin`; methods and headers as today.

Environment (defaults in `docker-compose.yml`, nothing secret in the repository): `MAILER_DSN`
(`smtp://mailpit:1025`), `MAIL_FROM` (`Travel expenses <no-reply@travel.local>`), `APP_ORIGIN`
(`http://localhost:8081`), `AUTH_CODE_TTL` (900), `AUTH_RESEND_GAP` (60), `AUTH_FAILURE_WINDOW` (120), `AUTH_LOCK`
(300), in seconds. The e2e run sets `AUTH_CODE_TTL=60`, `AUTH_LOCK=60`, `AUTH_RESEND_GAP=5` and its own `APP_ORIGIN`.

| Request | Response |
|---|---|
| `POST /auth/signup { display_name, email, password, language? }` | `202 { email, code_minutes, resend_in_seconds }` for a new, unverified or verified email alike. `422` as before without `taken`. `429 too_many_requests`. `503 mail_unavailable`. |
| `POST /auth/verify { email, code }` | `200 { token, user }` (user as `GET /me`). `422 { errors: { code: { code, message, params? } } }` with `wrong` (`params.tries_left`), `too_many`, or `expired` (also for an email without a pending code). `429 too_many_requests`. |
| `POST /auth/resend-code { email, language? }` | `202 { code_minutes, resend_in_seconds }` for any email. `429 { error: { code: "too_soon", params: { seconds } } }` within the gap; `429 too_many_requests` over 5 per hour. `503 mail_unavailable`. |
| `POST /auth/login { email, password, language? }` | `200 { token, user }` for a verified account. `401 invalid_credentials` as before. `403 { error: { code: "unverified", params: { code_minutes, resend_in_seconds } } }` for an unverified account with the right password (a new code is sent when the limits allow). `429 { error: { code: "locked", params: { minutes } } }` (1–5, rounded up). `503 mail_unavailable`. |

`too_many_requests` message "Too many requests. Try again later."; `mail_unavailable` "We could not send the email.
Try again in a moment."; `locked` "Too many attempts. Try again in {minutes} minutes."; `unverified` "Confirm your
email first.". The order of checks on login: per-email/IP lock, then the password, then verification.

**Web app:** the web export's HTML template carries `<meta http-equiv="Content-Security-Policy" content="default-src
'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' {API URL};
object-src 'none'; base-uri 'none'">`, with `{API URL}` from `EXPO_PUBLIC_API_URL` at export. `frame-ancestors` needs a
server header and is left for deployment.

**Dependencies and services:** `symfony/mailer` (exact version, `packages/api/composer.json`, the first PHP
dependency) and the image `axllent/mailpit` (exact tag) as service `mailpit` (SMTP 1025, inbox and API 8025), started
before `api` and the test runs. Both under Inventory in `specs/guidelines/architecture.md`.

**Dependency audits:** `bun test` also runs `composer audit` and `bun audit` (`tests/functional/audit.test.ts`).
`composer audit` must report nothing. `bun audit` must report nothing except the accepted exceptions below, each passed
as one `--ignore={id}`; any other advisory, of any severity and in any package, fails the run. The list lives in
`tests/functional/audit.test.ts`, one entry per advisory with every column of the table. The run also fails when an
entry is stale (`bun audit --json` without the ignores no longer reports that id: remove the entry) and on or after
its review date. While an entry has no Domain Lead approval link, the audit passes and prints "Waiting for Domain Lead
approval: {id}"; on the review date a missing link fails the run like any other entry. Entries record roles, never
names (personal data).

**Accepted audit exceptions:**

| Advisory | Package (severity) | Comes from | Why accepted | Accepted | Domain Lead approval | Review date |
|---|---|---|---|---|---|---|
| `GHSA-mrhx-c7xc-m3w5` | `zod` 3.25.76 (high) | `expo > @expo/cli` | Runs only in Expo's command-line tool on developer machines, on the project's own files; not in the shipped app and no user input reaches it. The fix, `zod` 4.6.6, is a major version no Expo 58 release accepts. In `bun.lock` since the first commit. | feature owner, 2026-10-29 | pending (issue or PR link) | 2027-01-31 |
| `GHSA-gcqx-w48m-w2h4` | `deepmerge` 4.3.1 (low) | `expo > @expo/config` | Build-time configuration merging of the project's own files; not in the shipped app. Blocked by `@expo/config`'s `^4.3.1`. In `bun.lock` since the first commit. | feature owner, 2026-10-29 | pending (issue or PR link) | 2027-01-31 |

## Seed data

No new groups, people or expenses: every figure of features 1–7 stays. The 10 demo accounts and the admin are created
verified. Figures the checks use:

- Group 8 "Ski week" (Pia): `300,00 €`; "Inés pays Pia `100,00 €`", "Grandpa pays Pia `100,00 €`"; Inés has a pending
  invite `ines@example.com`. After Inés confirms her code with the display name "Inés García", Pia's view reads "Inés
  García pays Pia `100,00 €`".
- Lisbon & Porto (group 1) stays at `1.915,57 €` for Ben.

These figures come from the existing seed and were checked with the current API code (`SummaryService`) on a fresh
in-memory database.

## Tests

- **PHP (`packages/api/tests`, run through `tests/functional`):** emails go through `MAILER_DSN` to Mailpit and are read
  from Mailpit's API (`MAILPIT_URL`, `http://mailpit:8025`), each test only reading messages to its own unique
  recipient; if Mailpit is not reachable the suite stops at once with "Mailpit is not running at {url}.". Time moves
  through the injectable clock with the real durations.
  - sign-up: `202` with the same body for a new, an unverified and a verified email; a new email gets one code email
    in the request's language (en, es, fr: subjects and bodies of the table), an unverified one has its name and
    password replaced, a verified one gets the "already" email and keeps its password; nothing is saved and `503` when
    the mailer fails; `taken` no longer exists.
  - verify: the right code gives a session and links invites (Inés on group 8); before it, nothing is linked and login
    gives `403 unverified`; 3 wrong codes give `wrong` 2, `wrong` 1, `too_many`, then the right code is refused; a new
    code replaces the old; a code expires after 15 minutes; the code is stored only hashed.
  - resend: `202` for unknown, unverified and verified emails, an email only for unverified ones; `429 too_soon` with
    the seconds left within 60 s; `too_many_requests` at the 6th within an hour.
  - login lock: 3 failures within 2 minutes lock the email for that IP for 5 minutes (also for the right password and
    an unknown email); failures spread over more than 2 minutes do not lock; another IP is not locked; after 5 minutes
    the right password works; `params.minutes` rounds up.
  - per-IP limits: the 11th sign-up and the 21st code check in an hour give `429 too_many_requests`.
  - security log: the expected events with email, IP and time, and no password, code or token anywhere in the table.
  - headers and CORS on a normal, an error and an `OPTIONS` response; no `Access-Control-Allow-Origin` for another
    origin; `REMOTE_ADDR` decides, `X-Forwarded-For` is ignored.
  - existing database: adding `verified_at` marks existing accounts verified once; a second start changes nothing.
  - every demo account and the admin log in; existing sign-up tests are updated to confirm the code.
- **TypeScript (`tests/unit`):** `signUp`, `verifyCode`, `resendCode` and `logIn` send the right body (with `language`)
  and handle `202`, `403 unverified` and `429` (fake `fetch`); the countdown text `m:ss`; the error texts by code, with
  `.one` for 1 try and 1 minute; every new key in en, es and fr.
- **Playwright (`tests/e2e`, 390x844):** a new `security.test.ts` with one screenshot per 📸 check, run with the short
  durations of the API section and reading codes from Mailpit's API. The suites of features 2, 3, 6 and 7 enter the
  code where they sign up.
- **Audits:** `composer audit` and `bun audit` run in `bun test`, with the accepted exceptions of the API section; the
  test also checks each entry: all its fields filled, its id still reported without the ignores (else stale), today
  before its review date, and a "Waiting for Domain Lead approval" line for each entry without a link.

## Acceptance checks

Viewport 390x844. Freshly seeded database and an empty Mailpit (`docker compose down -v && docker compose up`). App at
http://localhost:8081, Mailpit at http://localhost:8025. Every demo password is `travel-demo-2026`. Unless a check says
otherwise the durations are the real ones; checks 3, 9 and 10 wait for an expiry and are run (and tested) with the e2e
durations (`AUTH_CODE_TTL=60`, `AUTH_LOCK=60`, `AUTH_RESEND_GAP=5`).

1. 📸 **Sign up in French.** Fresh browser, tap "Français", then "Pas encore de compte ? S’inscrire". Sign up as "Margot",
   `margot@example.com`, `long-enough-1`. "Consultez vos e-mails" opens with "Nous avons envoyé un code à 6 chiffres à
   margot@example.com. Il est valable 15 minutes.", the code field, "Envoyer un nouveau code dans 0:59" (disabled) and
   "Confirmer" at the bottom. Mailpit has one email to `margot@example.com`, subject "Confirmez votre adresse e-mail",
   in French, with a 6-digit code and no code in the subject. Enter the code and tap "Confirmer": "Mes groupes" opens
   with "Connecté en tant que Margot".
2. 📸 **Wrong code three times.** Sign up as `nina@example.com` (English). Enter `000000` and tap "Confirm": "This code
   is wrong. 2 tries left."; again: "This code is wrong. 1 try left."; again: "Too many wrong codes. Send a new code.".
   The code from the email now shows the same message.
3. **Send a new code.** On Nina's screen (e2e durations), wait until "Send a new code" is enabled and tap it: "We sent
   a new code.", the field is empty, and the button reads "Send a new code in 0:05", disabled, counting down. Mailpit
   has a second email. The first code shows "This code is wrong. 2 tries left." (the new code replaced it); the second
   opens "My groups".
4. 📸 **Sign-up with an existing email.** Sign up as "Someone", `ana@example.com`, `another-pass-1`: the same "Check
   your email" screen. Mailpit has "You already have an account" to `ana@example.com` ("Hi Ana,") and no code. Log in
   as Ana with `travel-demo-2026`: "My groups" opens; with `another-pass-1`: "Email or password is wrong.".
5. **Sign-up again before confirming.** Sign up as "Olaf", `olaf@example.com`, `first-pass-1`, tap "‹ Log in", then sign
   up again as "Olaf B", `olaf@example.com`, `second-pass-1`. Confirm the newest code: "Logged in as Olaf B". Log out:
   `second-pass-1` logs in, `first-pass-1` shows "Email or password is wrong.".
6. **Login to an unverified account.** Sign up as `paula@example.com` (`long-enough-1`) and tap "‹ Log in" without the
   code. Log in with `wrong-pass-1`: "Email or password is wrong." and no new email. Log in with `long-enough-1`: "Check
   your email" opens and Mailpit has a second code email; that code opens "My groups".
7. 📸 **Invites wait for the code.** Sign up as "Inés García", `ines@example.com`, `long-enough-1`. Before entering the
   code, log in as Pia in a second browser: "Ski week" shows "Inés pays Pia `100,00 €`". Enter Inés's code: "My groups"
   shows "Ski week" `300,00 €`; Pia's "Ski week" now shows "Inés García pays Pia `100,00 €`".
8. 📸 **Three wrong passwords lock the login.** Log in as `ben@example.com` with `wrong-1`, `wrong-2`, `wrong-3`: the
   first two show "Email or password is wrong.", the third "Too many attempts. Try again in 5 minutes.". With
   `travel-demo-2026`: the same lock message. With `nobody@example.com` and three wrong passwords: the same lock message
   after the third.
9. **The lock ends.** With the e2e durations, after check 8's lock for Ben: "Too many attempts. Try again in 1
   minute."; after a minute, `travel-demo-2026` opens Ben's "My groups" with "Lisbon & Porto" `1.915,57 €`.
10. **A code expires.** With the e2e durations, sign up as `quentin@example.com`, wait a minute and enter the code:
    "This code has expired. Send a new code.".
11. 📸 **API unreachable and mail down.** On "Check your email", with the API blocked, "Confirm" and "Send a new code"
    show "Could not reach the API at http://localhost:8080." and the input stays. With Mailpit stopped (`docker
    compose stop mailpit`), "Create account" with `rita@example.com` shows "We could not send the email. Try again in a
    moment." on Sign-up, the input stays, and after `docker compose start mailpit` the same tap opens "Check your
    email". In the console, a login to `rita@example.com` before that answers `401` (nothing was saved).
12. **Security headers and CORS.** In the console, a response of `GET /health`, of `GET /trips` without a token (`401`)
    and of an `OPTIONS` request each have `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and
    `Cache-Control: no-store`; `Access-Control-Allow-Origin` is `http://localhost:8081` for requests from the app and
    missing for `Origin: https://example.org`. On the web app, injecting an inline `<script>` with the dev tools is
    refused with a Content-Security-Policy error in the console.
13. **Earlier features still hold.** With a fresh seed, every demo account and `admin@travel.local` log in as before, and
    the checks of features 1–7 pass, with the code step where they sign up.
14. **Rules checked in PHP only (clock and limits).** `bun test tests/functional` passes the tests listed in Tests for
    the lock window and end, other IPs, code expiry, the per-hour limits (`429 too_many_requests`) and the security log
    (expected events, no password, code or token).
15. **Dependency audits.** `bun test` runs `composer audit` and `bun audit`; `composer audit` reports nothing; `bun
    audit` reports nothing except the advisories listed under accepted exceptions (API section), each with its
    reason, acceptance, sign-off and review date, and the run prints "Waiting for Domain Lead approval" for each one
    without an approval link. A new advisory, a stale entry or a passed review date fails the run.

## Out of scope

A code at every login (two-step login), codes for new devices, verification links instead of codes, password reset
and changing the email or password, "log out everywhere" and ending sessions on a password change, longer passwords or
a common-password list, a clean-up of accounts that never confirm, trusting `X-Forwarded-For` before a proxy exists,
`frame-ancestors` and HTTPS (deployment), CAPTCHAs, HTML emails, a live countdown on the lock message, and storing the
values of `.env` files in the repository. For the audit: replacing Expo or forcing `zod` 4 with an override, ignoring
whole packages or severities, and obtaining the Domain Lead approval itself (the entry only records its link).

## Check on iOS and Android

- The code field opens the number pad and offers the code from the email or SMS bar (iOS "From Mail" one-time-code
  suggestion, Android autofill) without breaking the layout.
- With the keyboard open on "Check your email", "Confirm" stays reachable.
- "Send a new code" and "‹ Log in" respond across their full 48 px height; the countdown keeps time when the app goes to
  the background and comes back.
- A device reaches the API's `APP_ORIGIN` rule: native apps send no `Origin`, so CORS does not apply to them, and every
  request still works.
- Both platforms still build: Expo export for `ios` and `android` succeeds in the container.
