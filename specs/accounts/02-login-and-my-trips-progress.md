# 02-login-and-my-trips: progress

Tick a step as soon as it is built. Tick a check only after it passes in the browser and its test is green.

## Steps

- [x] Screens
- [x] Data
- [x] API
- [x] Seed data
- [x] Tests

## Acceptance checks

- [x] 1. 📸 **Login screen.** Open `/` with no stored token (a fresh browser profile). The Login screen shows "Travel expenses", "Log in to see your trips.", the Email and Password fields, "Log in" as a full-width 56 px button at the bottom, and "No account yet? Sign up" under it. No trip data is visible.
- [x] 2. 📸 **My trips, two trips.** Log in as `ana@example.com`. "My trips" shows "Logged in as Ana" and exactly two cards in this order: "Madrid weekend", "12 Sep 2026 – 14 Sep 2026", total `78,30 €`; then "Lisbon & Porto", "1 Jun 2026 – 7 Jun 2026", total `1.915,57 €`. "Log out" is in the header. There is no tab bar.
- [x] 3. **Open a trip.** On Ana's "My trips", tap "Lisbon & Porto". The epic 1 trip view opens with "‹ My trips" above the name "Lisbon & Porto", the total `1.915,57 €`, and "Ana pays Ben `63,75 €`", "David pays Ben `27,65 €`", "David pays Chloé `27,07 €`". The URL is `/?trip=1`. Tap "‹ My trips": the two cards from check 2 are back, and the URL has no `?trip=`.
- [x] 4. 📸 **Madrid trip view.** On Ana's "My trips", tap "Madrid weekend". The total shows `78,30 €`, "12 Sep 2026 – 14 Sep 2026 · 2 expenses", "2 people", and "Who owes whom" shows only "Ana pays Chloé `9,15 €`".
- [x] 5. **One trip only.** Log out, then log in as `ben@example.com`. "My trips" shows "Logged in as Ben" and exactly one card, "Lisbon & Porto" `1.915,57 €`. "Madrid weekend" is not listed.
- [x] 6. 📸 **Not a member.** Logged in as Ben, open `/?trip=7`. The screen shows "You are not a member of this trip." and "Go to My trips". The network tab shows `GET /trips/7` answered `403`. Tap "Go to My trips": Ben's one-card list from check 5, and the URL has no `?trip=`.
- [x] 7. **Unknown trip.** Logged in as Ben, open `/?trip=999`. The screen shows "This trip does not exist." and "Go to My trips". `/?trip=abc` shows the same, and no request is sent for it.
- [x] 8. 📸 **Wrong password.** Log out. On Login, enter `ana@example.com` and `wrong-password`, then tap "Log in". The owesSoft card shows "Email or password is wrong." The email field still contains `ana@example.com`. With an unknown email `nobody@example.com` and any password, the same message appears.
- [x] 9. **Email typed loosely.** On Login, enter `  ANA@Example.com ` (with spaces) and `travel-demo-2026`. "My trips" opens with Ana's two trips.
- [x] 10. 📸 **Sign-up errors.** Log out. Tap "No account yet? Sign up". Enter name `Zoe`, email `ana@example.com` and password `short`, then tap "Create account". "This email already has an account." shows under Email, and "Use at least 8 characters." shows under Password. The fields keep their values. Clear the name and tap again: "Enter your name." shows under the name. Enter `zoe` as the email: "Enter an email like ana@example.com." shows under Email.
- [x] 11. 📸 **Sign-up, empty list.** On Sign-up enter `Zoe`, `zoe@example.com`, `long-enough-1`, then tap "Create account". "My trips" opens with "Logged in as Zoe" and the card "You are not on any trip yet. When someone adds you to a trip with your email, it shows up here." Log out, then log in as `zoe@example.com` / `long-enough-1`: the same empty list.
- [x] 12. 📸 **Long name and large total in the list.** Log in as `noah@example.com`. One card: the trip name "Great tour of every UNESCO world heritage site in southern Europe by sleeper train" wraps to at most 2 lines and ends in "…" if it does not fit. "1 Apr 2026 – 30 Apr 2026". The total reads `2.345.678,91 €` on one line, right-aligned, and nothing scrolls sideways.
- [x] 13. **Zero total in the list.** Log in as `eva@example.com`. One card: "Empty weekend", "10 Jan 2026 – 12 Jan 2026", total `0,00 €`.
- [x] 14. 📸 **Add expense records as me.** Log in as `ana@example.com`, open "Madrid weekend" and tap "+ Add expense". The form has no "Recorded by" section. Enter "Churros", amount `6,00`, paid by Ana, split equally between Ana and Chloé, and save. The trip view shows the total `84,30 €`, "3 expenses", "Ana pays Chloé `6,15 €`", and the new row "Churros `6,00 €`" with "Recorded by Ana". Tap "‹ My trips": Madrid weekend shows `84,30 €`.
- [x] 15. **Client `recorded_by` is ignored.** Logged in as Ana, in the browser console send `POST /trips/1/expenses` with Ana's token, `recorded_by` set to Ben's person id and an otherwise valid body (e.g. "Coffee", `2,00 €` paid by Ana, split equally between all four). The response is `201` and `expense.recorded_by.name` is "Ana".
- [x] 16. **Log out ends the session.** Logged in as Ana, copy the token from `localStorage` (`travel-expenses.token`), then tap "Log out". Login appears. In the console, `GET /me` with the copied token answers `401` with code `unauthenticated`.
- [x] 17. **Reload keeps me logged in.** Log in as Ana and reload the page. "My trips" appears again without the Login screen.
- [x] 18. 📸 **Session ended.** Logged in as Ana with "Lisbon & Porto" open, delete the session on the server, either by sending `POST /auth/logout` with the same token in the console or by changing the stored token to `x`. Then tap "Balances" and reload, or tap "‹ My trips". Login appears with "Your session has ended. Please log in again." After logging in, "My trips" opens.
- [x] 19. **Deep link while logged out.** With no stored token, open `/?trip=1`. Login appears. Log in as `ben@example.com`: the "Lisbon & Porto" trip view opens directly (`1.915,57 €`).
- [x] 20. 📸 **API unreachable on Login.** With the API stopped (`docker compose stop api`), log out if needed, then on Login enter Ana's email and password and tap "Log in". The card shows "Could not reach the API at http://localhost:8080." The button reads "Log in" again and can be tapped. After `docker compose start api`, tapping "Log in" opens Ana's "My trips".
- [x] 21. **Epic 1 still holds.** Logged in as the owner of each fixture trip (Eva 2, Hugo 3, Jon 4, Noah 5, Olga 6), the epic 1 checks 6–11 show the same figures as before. The `api` container is healthy (`docker compose ps`), because the health check uses `GET /health`.
