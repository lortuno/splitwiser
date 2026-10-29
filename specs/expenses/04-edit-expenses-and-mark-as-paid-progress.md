# 04-edit-expenses-and-mark-as-paid: progress

Tick a step as soon as it is built. Tick a check only after it passes in the browser and its test is green.

## Steps

- [ ] Screens
- [x] Data
- [x] API
- [x] Seed data
- [x] Tests

## Acceptance checks

- [x] 1. 📸 **Open group view.** Log in as `ana@example.com` and open "Madrid weekend". The header shows "‹ My groups" and "Mark as paid". Both expense rows show "›" and are buttons at least 48 px high. Neither shows "Edited". The tab bar shows "+ Add expense".
- [x] 2. 📸 **Edit form, prefilled.** Tap "Tapas at Mercado de San Miguel". "Edit expense" opens with name "Tapas at Mercado de San Miguel", date `2026-09-12`, amount `48,30`, "Paid by" Chloé selected, "Equally" selected, "Split between" Ana and Chloé selected, the split preview Ana `24,15 €` / Chloé `24,15 €`, and "Save changes" at the bottom. There is no tab bar.
- [x] 3. **Save without changes.** Tap "Save changes" right away. The group view shows total `78,30 €`, "Ana pays Chloé `9,15 €`", and no "Edited" on any row.
- [x] 4. 📸 **Edit the amount.** Open "Tapas at Mercado de San Miguel", change the amount to `50,01`, and tap "Save changes". The group view shows total `80,01 €`, "Ana pays Chloé `10,01 €`", and the row "Tapas at Mercado de San Miguel `50,01 €`" with "Recorded by Chloé" and "Edited". Balances shows Ana `-10,01 €` and Chloé `+10,01 €`.
- [x] 5. **Edit the split type.** Open "Prado Museum tickets", choose "Percent", and enter Ana `70` and Chloé `30`. The preview shows Ana `21,00 €` and Chloé `9,00 €`. Save. The group view shows total `80,01 €` and "Ana pays Chloé `16,01 €`". Both rows show "Edited", and "Prado Museum tickets" still reads "Recorded by Ana". "‹ My groups": Madrid weekend shows `80,01 €`.
- [x] 6. **Invalid edit.** Open "Prado Museum tickets", clear the name and set the amount to `0`, then tap "Save changes". "Enter a name for the expense." and "Enter an amount greater than 0." appear, as in the add form. Tap "Cancel": the row still reads "Prado Museum tickets `30,00 €`" and the total is `80,01 €`.
- [x] 7. 📸 **Mark as paid, confirmation.** Tap "Mark as paid". The screen shows "Mark this group as paid?", "These payments will be treated as done:", "Ana pays Chloé `16,01 €`", "Nobody can add or change expenses until the group is reopened.", "Mark as paid" at the bottom and "Cancel". Tap "Cancel": the group view is unchanged. Tap "Mark as paid" again.
- [x] 8. 📸 **Paid group view.** On the confirmation, tap "Mark as paid". The group view shows the card "✓ Paid", "Marked as paid by Ana on {today}.", and total `80,01 €`. It shows no "Who owes whom", the header shows "Reopen", and the tab bar has only "Group" and "Balances". Tapping "Tapas at Mercado de San Miguel" opens nothing, and "Edited" still shows on both rows.
- [x] 9. 📸 **Balances of a paid group.** Tap "Balances". Ana shows Paid `30,00 €` and Share `46,01 €`, and Chloé shows Paid `50,01 €` and Share `34,00 €`. Both show "Settled" instead of a net amount. "Everyone is settled up." replaces the transfers, and no `16,01 €` appears.
- [ ] 10. **My groups shows paid.** Tap "‹ My groups". "Madrid weekend" is not in the list; "Lisbon & Porto" shows no chip. Tap "Paid groups (1) ▸": "Madrid weekend" shows "✓ Paid" and `80,01 €`.
- [x] 11. **Another member sees it.** Log in as `chloe@example.com` and open "Madrid weekend": the same paid view, with "Marked as paid by Ana on {today}." and "Reopen".
- [x] 12. **The API locks a paid group.** In the console with Chloé's token, `POST /trips/7/expenses` (any valid body), the same with `?dry_run=1`, and `PUT /trips/7/expenses/{Tapas id}` each answer `409` with code `trip_paid`. `POST /trips/7/paid` answers `409 already_paid`.
- [x] 13. 📸 **Paid while editing.** Log in as Ben in one browser tab, open "Lisbon & Porto" and open "Taxi to Porto airport". In a second tab, log in as Ana, open "Lisbon & Porto", and mark it as paid. In Ben's tab, change the amount to `32,00` and tap "Save changes". The card "This group is marked as paid. Reopen it to make changes." shows above the button, and the amount field still reads `32,00`. Tap "Cancel": the paid view of "Lisbon & Porto" with "Marked as paid by Ana on {today}.", and the row still reads `31,50 €`.
- [x] 14. **Reopen.** As Chloé on the paid "Madrid weekend", tap "Reopen". "Who owes whom" shows "Ana pays Chloé `16,01 €`" again, "+ Add expense" is back, the rows show "›" and "Edited", and the header shows "Mark as paid". In the console, `POST /trips/7/reopen` answers `409 already_open`. "‹ My groups": no chip on "Madrid weekend".
- [x] 15. **Paid with nothing to settle.** Log in as `eva@example.com` and open "Empty weekend". Tap "Mark as paid": the confirmation shows "Everyone is settled up." instead of a list. Confirm: the "✓ Paid" card, total `0,00 €`, and "Marked as paid by Eva on {today}.".
- [x] 16. **Very large amount.** Log in as `noah@example.com`, open the long-name group and open "Private jet charter". The amount field shows `1000000,00`. Tap "Save changes": the row reads `1.000.000,00 €` with no "Edited", and the total stays `2,34 M €`.
- [x] 17. 📸 **API unreachable.** With the API blocked: on Ana's "Edit expense" for "Prado Museum tickets" (Madrid, open again after check 14), "Save changes" shows the form's error card and the input stays. "Mark as paid" on the confirmation shows "Could not reach the API at http://localhost:8080." above the button, and the group stays open. On a paid group (Lisbon after check 13), "Reopen" shows the same message at the top of the Group tab, and the group stays paid. With the API back, each action works.
- [x] 18. **API errors.** In the console with Ana's token: `PUT /trips/1/expenses/{Tapas id}` (an expense of group 7) answers `404 not_found`. With Ben's token, `PUT /trips/7/expenses/{Tapas id}` answers `403 not_a_member`. `PUT`, `POST …/paid` and `POST …/reopen` without a token answer `401`. The change records of checks 4 and 5 hold Ana's user id, a time and before/after snapshots (checked by the PHP tests).
- [x] 19. **Earlier epics still hold.** With a fresh seed, the epic 1, 2 and 3 checks show the same figures as before.
