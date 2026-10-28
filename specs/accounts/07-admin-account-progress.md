# 07-admin-account: progress

Tick a step as soon as it is built. Tick a check only after it passes in the browser and its test is green.

## Steps

- [x] Screens
- [x] Data
- [x] API
- [x] Seed data
- [x] Tests

## Acceptance checks

- [x] 1. 📸 **Log in as admin.** Open the app, enter `admin@travel.local` and `admin123`, and tap "Log in". "My trips" shows "Logged in as Admin", the empty card "You are not on any trip yet. Start one with "+ New trip", or ask a friend to add you with your email." and "+ New trip" at the bottom. The header shows "Settings" and "Log out".
- [x] 2. **Email as typed.** Log out and log in again with `  ADMIN@Travel.local ` and `admin123`: "My trips" for Admin appears.
- [x] 3. **Wrong password and taken email.** Log out. Log in with `admin@travel.local` and `admin1234`: "Email or password is wrong." appears. Open "No account yet? Sign up", enter "Someone", `admin@travel.local` and `travel-demo-2026`, and tap "Create account": "This email already has an account." appears under the email.
- [x] 4. 📸 **The admin creates a trip with Ana.** Log in as admin, tap "+ New trip", enter "Team lunch", start and end date `2026-11-03`, and the person "Ana" with the email `ana@example.com`, then tap "Create trip". The trip view shows "Team lunch", `0,00 €`, "3 Nov 2026 – 3 Nov 2026 · 0 expenses" and "2 people"; the address bar shows `?trip=9`.
- [x] 5. **Ana sees the admin's trip.** Log out and log in as `ana@example.com`: "My trips" lists "Team lunch" (`0,00 €`), "Madrid weekend" (`78,30 €`) and "Lisbon & Porto" (`1.915,57 €`), in that order. Opening "Team lunch" shows "2 people".
- [x] 6. **A restart keeps the admin's changes.** Log in as admin, open "Settings", change the name to "Laura" and tap "Save", then choose "Español". Restart the API's start step (`init-db`): its log says "Admin account exists, left unchanged.". Reload: the app is in Spanish and "Mis viajes" shows "Sesión iniciada como Laura"; logging in again with `admin123` still works.
- [x] 7. **The start log on a fresh database.** On a fresh database the first start logs "Database created and seeded." and "Admin account created: admin@travel.local"; a second start logs "Admin account exists, left unchanged.".
- [x] 8. **The demo accounts are unchanged.** On a fresh seed, `ana@example.com` logs in with `travel-demo-2026` and sees exactly "Madrid weekend" and "Lisbon & Porto"; in the console, `GET /me` with Ana's token answers `id: 1`, and with the admin's token `id: 11`, `display_name: "Admin"`, `language: "en"`.
- [x] 9. **Earlier epics still hold.** With a fresh seed, the epic 1–6 checks pass with the same figures.
