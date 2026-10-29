# 05-expense-categories: progress

Tick a step as soon as it is built. Tick a check only after it passes in the browser and its test is green.

## Steps

- [x] Screens
- [x] Data
- [x] API
- [x] Seed data
- [x] Tests

## Acceptance checks

- [x] 1. 📸 **Icons on the group view.** Log in as `ana@example.com` and open "Lisbon & Porto". Every expense row starts with an icon box. "Taxi to Porto airport `31,50 €`" shows 🚕, "Airbnb Porto, 3 nights" 🏨, "Groceries at Pingo Doce" 🛒, "Fado night drinks" 🍺, "Dinner at the harbour" 🍴 and "Azulejo tile souvenir" 🛍️. The amounts and "›" still sit on the first line of each row, and the page does not scroll sideways.
- [x] 2. 📸 **Category section in the add form.** Open "Madrid weekend" and tap "+ Add expense". Under "What was it?" the section "Category" shows the hint "Pick a category, or type a name to get a suggestion." and 11 chips in the table's order, each at least 48 px high, with "🧾 Other" selected.
- [x] 3. 📸 **Suggestion with a typo.** Type "Gasolne Repsol" as the name. Within a second "⛽ Fuel" is selected and the hint reads "Suggested from the name. Tap to change.".
- [x] 4. **Languages, first word and no match.** Replace the name, waiting a second each time: "Abendessen im Hotel" selects "🍴 Food"; "Hotel Abendessen" selects "🏨 Lodging"; "Café con churros" selects "☕ Coffee"; "Airport taxi" selects "🚕 Transport"; "Xyzzy" selects "🧾 Other"; clearing the name selects "🧾 Other" and shows the empty-name hint.
- [x] 5. 📸 **A tapped category sticks, then save.** Type "Dinner": "🍴 Food" is selected. Tap "🍺 Drinks", then complete the name to "Dinner and wine" and wait a second: "🍺 Drinks" stays selected. Enter date `2026-09-14`, amount `20,00`, "Paid by" Ana, and tap "Save expense". The group view shows total `98,30 €`, "Chloé pays Ana `0,85 €`", and the row "Dinner and wine `20,00 €`" with 🍺.
- [x] 6. **The group learns.** Tap "+ Add expense" and type "dinner and WINE": "🍺 Drinks" is selected (from the expense of check 5). Tap "Cancel": the total is still `98,30 €`.
- [x] 7. **Learning stays in its group.** Go to "‹ My groups", open "Lisbon & Porto", tap "+ Add expense" and type "Dinner and wine": "🍴 Food" is selected. Tap "Cancel".
- [x] 8. 📸 **Change only the category.** Open "Madrid weekend" and tap "Tapas at Mercado de San Miguel". "Edit expense" shows "🍴 Food" selected. Tap "🍺 Drinks" and "Save changes". The row shows 🍺 and "Edited"; the total is still `98,30 €` and "Chloé pays Ana `0,85 €`".
- [x] 9. **The edit form never re-suggests.** Tap "Prado Museum tickets": "🎟️ Activities" is selected. Change the name to "Prado dinner" and wait a second: "🎟️ Activities" stays selected. Tap "Cancel": the row still reads "Prado Museum tickets" with 🎟️ and no "Edited".
- [x] 10. **Paid group keeps its icons.** Tap "Mark as paid" and confirm. The paid view shows the rows with their icons: "Dinner and wine" 🍺, "Prado Museum tickets" 🎟️ and "Tapas at Mercado de San Miguel" 🍺, without "›".
- [x] 11. 📸 **Long name and very large amount.** Log in as `noah@example.com` and open the long-name group. The 120-character sleeper train row shows 🚕, its name wraps to 2 lines right of the icon, and its amount `345.678,91 €` stays on the first line. "Private jet charter `1.000.000,00 €`" shows ✈️ and "Yacht week" 🎟️. The total still reads `2,34 M €` and the page does not scroll sideways.
- [x] 12. **Screen reader label.** As Ana on "Lisbon & Porto", the row "Taxi to Porto airport" is a button whose accessible name is "Transport, Taxi to Porto airport, 31,50 €", and the emoji is not part of the accessible text.
- [x] 13. 📸 **API unreachable.** As `ben@example.com`, open "Lisbon & Porto" and tap "+ Add expense". Block the API, type "Taxi" and wait a second: "🧾 Other" stays selected and no error message appears. Enter amount `10,00`, choose "Paid by" Ben and tap "Save expense": the existing form error card appears and the input stays. Unblock the API and type a space after "Taxi": "🚕 Transport" is selected.
- [x] 14. **The suggestion endpoint.** In the console with Ana's token: `GET /trips/1/category-suggestion?name=gasolne` answers `{ "category": "fuel", "source": "keywords" }`; `GET /trips/7/category-suggestion?name=Dinner%20and%20wine` answers `{ "category": "drinks", "source": "trip" }` (Madrid is paid since check 10: still `200`); `?name=Xyzzy` and a missing `name` answer `{ "category": "other", "source": "none" }`. Without a token: `401`. `GET /trips/999/category-suggestion?name=x`: `404 not_found`. With Ben's token on group 7: `403 not_a_member`.
- [x] 15. **Categories on write.** With Hugo's token (`hugo@example.com`, group 3 "Even split"): `POST /trips/3/expenses` with a valid body and `"category": "pets"` answers `422` with `errors.category.code` `invalid_category`. The same body without `category` and with the name "Taxi" answers `201` with `expense.category` `transport`. `PUT` of that expense with only `"category": "other"` changed answers `200` with `category` `other` and `edited: true`; a `PUT` without `category` keeps `other`.
- [x] 16. **Seed categories.** With Ana's token, `GET /trips/1/expenses` returns the categories of the seed table for all 20 expenses; `GET /trips/7/expenses` on a fresh seed returns `food` for "Tapas at Mercado de San Miguel" and `activities` for "Prado Museum tickets".
- [x] 17. **Earlier epics still hold.** With a fresh seed, the epic 1–4 checks show the same figures as before.
