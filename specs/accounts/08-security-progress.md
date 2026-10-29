# 08-security: progress

Tick a step as soon as it is built. Tick a check only after it passes in the browser and its test is green.

## Steps

- [x] Screens
- [x] Data
- [x] API
- [x] Seed data
- [ ] Tests

## Acceptance checks

- [x] 1. 📸 **Sign up in French.** Fresh browser, tap "Français", then "Pas encore de compte ? S’inscrire". Sign up as "Margot", `margot@example.com`, `long-enough-1`. "Consultez vos e-mails" opens with "Nous avons envoyé un code à 6 chiffres à margot@example.com. Il est valable 15 minutes.", the code field, "Envoyer un nouveau code dans 0:59" (disabled) and "Confirmer" at the bottom. Mailpit has one email to `margot@example.com`, subject "Confirmez votre adresse e-mail", in French, with a 6-digit code and no code in the subject. Enter the code and tap "Confirmer": "Mes groupes" opens with "Connecté en tant que Margot".
- [x] 2. 📸 **Wrong code three times.** Sign up as `nina@example.com` (English). Enter `000000` and tap "Confirm": "This code is wrong. 2 tries left."; again: "This code is wrong. 1 try left."; again: "Too many wrong codes. Send a new code.". The code from the email now shows the same message.
- [x] 3. **Send a new code.** On Nina's screen (e2e durations), wait until "Send a new code" is enabled and tap it: "We sent a new code.", the field is empty, and the button reads "Send a new code in 0:05", disabled, counting down. Mailpit has a second email. The first code shows "This code is wrong. 2 tries left." (the new code replaced it); the second opens "My groups".
- [x] 4. 📸 **Sign-up with an existing email.** Sign up as "Someone", `ana@example.com`, `another-pass-1`: the same "Check your email" screen. Mailpit has "You already have an account" to `ana@example.com` ("Hi Ana,") and no code. Log in as Ana with `travel-demo-2026`: "My groups" opens; with `another-pass-1`: "Email or password is wrong.".
- [x] 5. **Sign-up again before confirming.** Sign up as "Olaf", `olaf@example.com`, `first-pass-1`, tap "‹ Log in", then sign up again as "Olaf B", `olaf@example.com`, `second-pass-1`. Confirm the newest code: "Logged in as Olaf B". Log out: `second-pass-1` logs in, `first-pass-1` shows "Email or password is wrong.".
- [x] 6. **Login to an unverified account.** Sign up as `paula@example.com` (`long-enough-1`) and tap "‹ Log in" without the code. Log in with `wrong-pass-1`: "Email or password is wrong." and no new email. Log in with `long-enough-1`: "Check your email" opens and Mailpit has a second code email; that code opens "My groups".
- [x] 7. 📸 **Invites wait for the code.** Sign up as "Inés García", `ines@example.com`, `long-enough-1`. Before entering the code, log in as Pia in a second browser: "Ski week" shows "Inés pays Pia `100,00 €`". Enter Inés's code: "My groups" shows "Ski week" `300,00 €`; Pia's "Ski week" now shows "Inés García pays Pia `100,00 €`".
- [x] 8. 📸 **Three wrong passwords lock the login.** Log in as `ben@example.com` with `wrong-1`, `wrong-2`, `wrong-3`: the first two show "Email or password is wrong.", the third "Too many attempts. Try again in 5 minutes.". With `travel-demo-2026`: the same lock message. With `nobody@example.com` and three wrong passwords: the same lock message after the third.
- [x] 9. **The lock ends.** With the e2e durations, after check 8's lock for Ben: "Too many attempts. Try again in 1 minute."; after a minute, `travel-demo-2026` opens Ben's "My groups" with "Lisbon & Porto" `1.915,57 €`.
- [x] 10. **A code expires.** With the e2e durations, sign up as `quentin@example.com`, wait a minute and enter the code: "This code has expired. Send a new code.".
- [x] 11. 📸 **API unreachable and mail down.** On "Check your email", with the API blocked, "Confirm" and "Send a new code" show "Could not reach the API at http://localhost:8080." and the input stays. With Mailpit stopped (`docker compose stop mailpit`), "Create account" with `rita@example.com` shows "We could not send the email. Try again in a moment." on Sign-up, the input stays, and after `docker compose start mailpit` the same tap opens "Check your email". In the console, a login to `rita@example.com` before that answers `401` (nothing was saved).
- [x] 12. **Security headers and CORS.** In the console, a response of `GET /health`, of `GET /trips` without a token (`401`) and of an `OPTIONS` request each have `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` and `Cache-Control: no-store`; `Access-Control-Allow-Origin` is `http://localhost:8081` for requests from the app and missing for `Origin: https://example.org`. On the web app, injecting an inline `<script>` with the dev tools is refused with a Content-Security-Policy error in the console.
- [x] 13. **Earlier features still hold.** With a fresh seed, every demo account and `admin@travel.local` log in as before, and the checks of features 1–7 pass, with the code step where they sign up.
- [x] 14. **Rules checked in PHP only (clock and limits).** `bun test tests/functional` passes the tests listed in Tests for the lock window and end, other IPs, code expiry, the per-hour limits (`429 too_many_requests`) and the security log (expected events, no password, code or token).
- [ ] 15. **Dependency audits.** `bun test` runs `composer audit` and `bun audit`; `composer audit` reports nothing; `bun audit` reports nothing except the advisories listed under accepted exceptions (API section), each with its reason, acceptance, sign-off and review date, and the run prints "Waiting for Domain Lead approval" for each one without an approval link. A new advisory, a stale entry or a passed review date fails the run.
