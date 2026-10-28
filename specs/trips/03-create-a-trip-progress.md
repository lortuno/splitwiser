# 03-create-a-trip: progress

Tick a step as soon as it is built. Tick a check only after it passes in the browser and its test is green.

## Steps

- [x] Screens
- [x] Data
- [x] API
- [x] Seed data
- [x] Tests

## Acceptance checks

- [x] 1. 📸 **My trips has "+ New trip".** Log in as `ana@example.com`. "My trips" shows the header "My trips", the menu in the app bar lists "Settings" and "Log out", the cards "Madrid weekend" `78,30 €` and "Lisbon & Porto" `1.915,57 €`, and a full-width 56 px "+ New trip" button fixed at the bottom of the screen.
- [x] 2. 📸 **New trip form.** Tap "+ New trip". The screen shows "‹ My trips", "New trip", an empty "Trip name", start and end dates prefilled with today's date as `YYYY-MM-DD`, the fixed row "Ana (you)" without "Remove", one empty person card with "Name", "Email (optional)" and "Remove", "+ Add person", and "Create trip" at the bottom.
- [x] 3. 📸 **Create a trip with three people.** Enter "Summer in Sicily", start `2026-07-10`, end `2026-07-17`. In the first card enter "Ben" and `  BEN@Example.com `. Tap "+ Add person" and enter "Grandma" with no email. Tap "Create trip". The trip view opens with "‹ My trips" and "Summer in Sicily", the total `0,00 €`, "10 Jul 2026 – 17 Jul 2026 · 0 expenses", "3 people" and "No expenses yet. Tap + Add expense to record the first one." (no "Who owes whom", as in epic 1). The URL is `/?trip=9`. The Balances tab shows every balance `0,00 €` and "Everyone is settled up."
- [x] 4. **First expense, uneven split, name-only member.** In "Summer in Sicily" tap "+ Add expense". The chips under "Paid by" and "Split between" are Ana, Ben and Grandma. Enter "Dinner", date `2026-07-10`, amount `10,00`, paid by Ana, split equally between all three, and save. The trip view shows total `10,00 €`, "1 expense", "Ben pays Ana `3,33 €`" and "Grandma pays Ana `3,33 €`". Balances shows Ana `+6,66 €`, Ben `−3,33 €`, Grandma `−3,33 €`. Tap "‹ My trips": three cards in this order: "Madrid weekend" `78,30 €`, "Summer in Sicily" `10,00 €`, "Lisbon & Porto" `1.915,57 €`.
- [x] 5. **Linked member sees the trip.** Log out and log in as `ben@example.com`. "My trips" shows "Summer in Sicily" `10,00 €` above "Lisbon & Porto" `1.915,57 €`. Opening it shows "Ben pays Ana `3,33 €`".
- [x] 6. **Not linked without the email.** Log in as `chloe@example.com`. "Summer in Sicily" is not listed. Opening `/?trip=9` shows "You are not a member of this trip."
- [x] 7. 📸 **Validation errors.** Log in as Ana and tap "+ New trip". Leave the trip name empty, set start `2026-07-17` and end `2026-07-10`. In the first card enter "ana" with email `ana@example.com`. Add a card "Ben" with email `ben@x`. Add a card "ben". Tap "Create trip". Under the trip name: "Enter a name for the trip." Under End date: "The end date is before the start." Under the first card's name: "This name is already on the trip." Under its email: "This email is already on the trip." Under the second card's email: "Enter an email like ana@example.com." Under the third card's name: "This name is already on the trip." Above the button: "Please fix the fields marked in red." Tap "‹ My trips": still three trips, nothing was saved.
- [x] 8. **At least one more person.** On "New trip" enter "Solo", keep the dates, remove the only person card and tap "Create trip". Under "People": "Add at least one more person." Nothing is saved.
- [x] 9. **Limits.** On "New trip", tap "+ Add person" until there are 19 cards (20 people with Ana): "+ Add person" is gone. An 81-character trip name shows "Use at most 80 characters." An 80-character name with valid people is saved. The name wraps to at most 2 lines with "…" on "My trips", and shows on 1 line with "…" in the trip header, and nothing scrolls sideways.
- [x] 10. 📸 **Pending invite linked at sign-up.** Log out, tap "No account yet? Sign up", and sign up as "Inés García", `ines@example.com`, `long-enough-1`. "My trips" opens with "Logged in as Inés García" and the card "Ski week", "19 Dec 2026 – 26 Dec 2026", `300,00 €`. Opening it shows "Inés García pays Pia `100,00 €`" and "Grandpa pays Pia `100,00 €`".
- [x] 11. **Empty list text.** Sign up as `zoe@example.com` (any name, `long-enough-1`). The card reads "You are not on any trip yet. Start one with "+ New trip", or ask a friend to add you with your email." "+ New trip" is at the bottom.
- [x] 12. 📸 **The display name.** Log in as Ana and open "Settings" from the menu. The field shows "Ana". Clear it and tap "Save": "Fill in this field." under the field. Enter "Ana María" and tap "Save": "My trips" shows "Logged in as Ana María". Open "Lisbon & Porto": "Ana María pays Ben `63,75 €`", and the expense "Airport taxi to Alfama" reads "Recorded by Ana María". Log in as Ben and open "Summer in Sicily": "Ben pays Ana María `3,33 €`".
- [x] 13. 📸 **API unreachable.** With the API stopped (`docker compose stop api`, or the e2e suite blocking it), on "New trip" with a filled-in form tap "Create trip": the owesSoft card "Could not reach the API at http://localhost:8080." shows above the button, the input stays, and "Create trip" can be tapped again. The same happens on "Settings" with "Save". After `docker compose start api`, tapping "Create trip" saves the trip.
- [x] 14. **Token required.** In the console, `POST /trips` and `PATCH /me` without `Authorization` answer `401` with code `unauthenticated`.
- [x] 15. **Earlier epics still hold.** With a fresh seed, the epic 1 and epic 2 checks show the same figures as before. The exception is the new empty-state text in epic 2 check 11 (this spec's check 11).
