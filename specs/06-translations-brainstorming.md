# Translations (English, Spanish, French) — brainstorming

Source: new feature (not in `specs/roadmap.md`). Boundaries: `specs/guidelines/architecture.md`,
`specs/guidelines/ui.md`. Append-only: questions and answers are never changed once written. Answer by moving the
`[x]` or adding a note under the question.

## What exists today (for reference)

- **All app text already goes through one function.** `packages/app/src/i18n/en.ts` holds 133 English strings (keys
  like `trip.totalSpend`, `add.save`, `month.1`–`month.12`, `category.food`) and `src/i18n/index.ts` has `t(key,
  params)`, `tCount()` (the ".one" variant for a count of 1), `formatDate()` ("28 Oct 2026") and `formatLocalDate()`.
  The comment in `en.ts` already says "Add another locale by creating a file with the same keys". There is no
  language switch and no other locale.
- **Some text the person sees comes from the API, in English.** Every field error is `{ code, message }` (e.g.
  `required` / "Enter a name for the expense.", `sum_mismatch` / "Paid amounts add up to 45,00 € but the expense is
  50,00 €.") and the screens show `message` as it arrives. `ValidationException` notes the code is "for future
  translation". Other errors (`trip_paid`, `already_paid`, …) are already turned into app text by their `code`. A
  network failure in the expense form shows the raw "TypeError: Failed to fetch".
- **Formats:** money is always "1.234,56 €" (comma decimals, dot thousands, `src/money/format.ts`); input accepts "12,50"
  and "12.50". Dates are "day month year" with English month abbreviations.
- **Storage:** the session token is in `localStorage` on the web and only in memory on iOS and Android (no storage
  dependency). `users` holds `display_name`, `email` and timestamps; `PATCH /me` changes the display name.
- **Not translated by nature:** what people typed (trip and expense names, people's names) and the seed data.
- **Category guessing (epic 5)** knows English, German and Spanish words, not French.
- **Pilot rule:** text the app shows to users should be checked by a person before release; machine-drafted
  translations count as a draft.

---

## Round 1

Functionality and the rules behind it.

### Q1. What has to be translated?
- [x] Everything the app itself writes: all 133 strings, month names and category labels, plus the API's field errors, which the app words itself by their `code` (see Q2). People's own text (trip, expense and people's names) stays as typed. (Recommended)
- [ ] Only the app's own strings; field errors from the API stay in English.

### Q2. How do the API's error messages get translated?
- [x] The app owns all wording: it shows its own text for each error `code`, never the API's `message`. Errors that contain numbers (`sum_mismatch`) get a new `params` object from the API with the values in cents (e.g. `{ "paid_cents": 4500, "amount_cents": 5000 }`), which the app formats. The API stays English-only, and its `message` stays for logs and tools. (Recommended: fits "UI text lives in `src/i18n`", and the API needs no language.)
- [ ] The API translates: the app sends `Accept-Language`, and the API returns `message` in that language (translation files in PHP too).
- [ ] Leave API errors in English.

### Q3. Which language does the app start in?
- [x] English, always, until the person picks another one. (Recommended: what you asked for.)
- [ ] The device's language when it is Spanish or French, otherwise English.

### Q4. Where is the chosen language kept?
- [x] On the account (`users.language`, changed through `PATCH /me`), so it follows the person to every device and survives a cold start on iOS and Android. The web also keeps the last choice on the device, so Login and Sign up appear in that language before anyone logs in. (Recommended)
- [ ] Only on the device (`localStorage` on the web, memory on iOS/Android, so phones fall back to English on every cold start).
- [ ] Only on the account; Login and Sign up are always in English.

### Q5. Where can the language be switched?
Wireframes follow in the next round.
- [x] On Login and Sign up (before an account is known), and on "Your name", which becomes "Settings" with name and language. (Recommended)
- [ ] Only after login, on "Your name" / "Settings".
- [ ] A language button in the "My trips" header.

### Q6. Do amounts and dates change format with the language?
- [x] Amounts stay "1.234,56 €" in all three languages (one rule, every existing check keeps its figures). Dates keep "day month year" with translated month abbreviations: "28 Oct 2026", "28 oct 2026", "28 oct. 2026". (Recommended)
- [ ] Amounts also follow the language: French "1 234,56 €" with spaces, Spanish and English "1.234,56 €".
- [ ] Nothing changes but the words: English month names everywhere.

### Q7. How are the translation files kept complete?
- [x] One TypeScript file per language next to `en.ts` (`es.ts`, `fr.ts`), typed against the English keys, so a missing or extra key fails the type check. A unit test also checks that every string keeps the same `{placeholders}`. Each language has its own plural rule (French uses the singular for 0 and 1: "0 dépense", "1 dépense"). (Recommended: no dependency, errors show before the app runs.)
- [ ] JSON files (`es.json`, `fr.json`) loaded at runtime, checked only by a unit test.

### Q8. Who writes the Spanish and French texts, and do category suggestions learn French?
- [x] The build drafts both files; a Spanish and a French speaker review them before release (marked in the spec as a release step). French words and brands are added to the category keywords (epic 5), so "Dîner au restaurant" or "Essence Total" get a suggestion too. (Recommended)
- [ ] The build drafts both files and they ship as they are; category keywords stay English, German and Spanish.
- [ ] You provide the translations; the build leaves them as copies of English until then.

- [x] Round 1 answered (tick this when you have answered every question above)

## Round 2

Round 1 answers: every recommendation was kept (all app text plus API errors worded by the app from `code` and
`params`; English by default; language kept on the account and, on the web, on the device; switch on Login, Sign up
and a new "Settings" screen; amounts unchanged, month names translated; typed TS files per language with their own
plural rule; drafted in the build and reviewed by native speakers; French category keywords).

Screens and interaction on a phone. Correct the wireframes directly under each question if something is off.

### Q1. Language switch on Login (and the same on Sign up)
```
┌──────────────────────────────────────┐
│ Travel expenses                      │
│ Log in to see your trips.            │
│                                      │
│ Email                                │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│ Password                             │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│                                      │
│ [English] [Español] [Français]       │  segmented control, 48 high,
│                                      │  selected = accent; each name
│            (flexible space)          │  in its own language
│ ┌──────────────────────────────────┐ │
│ │              Log in              │ │  primary, 56 high, bottom
│ └──────────────────────────────────┘ │
│      No account yet? Sign up         │
└──────────────────────────────────────┘
```
- [x] A three-part segmented control (like "How to split") under the form, above the flexible space; each language written in its own language. Tapping one switches the whole screen at once, no reload. (Recommended)
- [ ] A single text button in the top right ("English ▾") that opens a list of the three languages.
- [ ] The control at the very top, above "Travel expenses".

### Q2. "Settings" (today "Your name") and the "My trips" header
```
┌──────────────────────────────────────┐
│ My trips            Settings Log out │  "Your name" becomes "Settings"
├──────────────────────────────────────┤
…
┌──────────────────────────────────────┐
│ ‹ My trips                           │
│ Settings                             │  title 20 bold
├──────────────────────────────────────┤
│ Name                                 │
│ This is how you appear on all your   │
│ trips.                               │
│ ┌──────────────────────────────────┐ │
│ │ Ana                              │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Language                             │
│ [English] [Español] [Français]       │  same control as on Login
│                                      │
│            (flexible space)          │
│ ┌──────────────────────────────────┐ │
│ │               Save               │ │  primary, 56 high; saves the
│ └──────────────────────────────────┘ │  name only
└──────────────────────────────────────┘
```
- [x] The language applies and is saved (`PATCH /me { language }`) as soon as it is tapped, without "Save"; "Save" keeps saving only the name, as today. If saving the language fails, the app still switches and shows "Could not reach the API at {url}." under the control; the account keeps the old language. (Recommended)
- [ ] The language is saved together with the name by "Save".

### Q3. When the device and the account disagree
Ana's account says Spanish, but someone switched Login to French on this browser before logging in.
- [x] A switch made on Login or Sign up during this visit wins and is saved to the account right after login (a sign-up stores it on the new account). Without such a switch, the account's language applies after login and is copied to the device. (Recommended: the last thing the person chose wins.)
- [ ] The account always wins after login; a switch on Login only lasts until login.

### Q4. Longer French and Spanish texts on a 390 px screen
"+ Ajouter une dépense", "Marquer comme payé" next to "‹ Mes voyages", "À parts égales" in the split control.
- [x] Every translation must fit the existing layouts at 390 px: labels may wrap to a second line where the layout already allows it (segments, chips, cards), and are reworded shorter where it does not (tab bar, header buttons). The checks screenshot the tightest screens in French. (Recommended)
- [ ] Let every label shrink its font size to fit (`adjustsFontSizeToFit`).

### Q5. Screen readers and the web page
- [x] The web page's `lang` attribute follows the language (`en`, `es`, `fr`), so screen readers pronounce it correctly; all accessibility labels (e.g. epic 5's "Transport, Taxi to Porto airport, 31,50 €") are translated too. (Recommended)
- [ ] Only the visible text is translated.

### Q6. Which screens change?
- [x] Visible change only on Login, Sign up, "My trips" (header button) and "Settings"; every other screen just shows its text in the chosen language, with no layout change. (Recommended)
- [ ] Also add a language indicator to the "My trips" header.

- [x] Round 2 answered (tick this when you have answered every question above)

## Round 3

Round 2 answers: every recommendation was kept (segmented control on Login and Sign up; "Your name" becomes
"Settings" with name and language, the language saved at once; a switch on Login or Sign up wins and is saved after
login; translations reworded to fit 390 px; `lang` attribute and accessibility labels translated; visible changes only
on Login, Sign up, My trips header and Settings).

Data, API, edge cases and the test data they need.

### Q1. How is the language stored and returned?
- [x] A new column `users.language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'es', 'fr'))`, added to existing databases by the `ADDED_COLUMNS` step from epic 5 (existing accounts become English). The user object in `GET /me`, `POST /auth/login` and `POST /auth/signup` gets `language`. (Recommended)
- [ ] A separate `user_settings` table (user id, key, value) for this and future settings.

### Q2. Request shapes and validation
- [x] `PATCH /me` takes `display_name` and/or `language`, each optional (a body with neither is `422 display_name required`, as today). `POST /auth/signup` takes an optional `language` (missing → `en`). Any other value is `422` on the field `language`, code `invalid_language`. (Recommended)
- [ ] A separate endpoint `PUT /me/language { language }`.

### Q3. Which API errors get `params`, and what if the app does not know a code?
- [x] Only the three that contain numbers: `paid_by` `sum_mismatch` → `{ paid_cents, amount_cents }`; `split` `sum_mismatch` for exact amounts → `{ split_cents, amount_cents }`; `split` `sum_mismatch` for percentages → `{ basis_points }`. A code the app has no text for falls back to the API's English `message`, so nothing is ever blank. (Recommended)
- [ ] Give every error a `params` object, even an empty one.

### Q4. The raw "TypeError: Failed to fetch" in the expense form
- [x] Replace it with the translated "Could not reach the API at {url}.", as every other screen already shows. Epic 4's check 17 and epic 5's check 13 then expect that text. (Recommended)
- [ ] Leave it as it is.

### Q5. Seed data
- [x] No seed changes: all 10 demo accounts stay English (the default), every earlier figure and check holds, and the checks switch languages through the app. (Recommended)
- [ ] Seed one demo account in Spanish (e.g. Chloé), so a check can log in straight into Spanish.

### Q6. Storage on the device fails or is missing
- [x] Web: the choice is kept under `travel-expenses.language` in `localStorage`; when storage is blocked (private window), the app still switches for the visit and keeps it on the account after login. iOS and Android keep it in memory until login, then use the account's language (no storage dependency, as for the session token). (Recommended)
- [ ] Add a storage dependency (`AsyncStorage`) so phones remember the choice before login too.

### Q7. How do we make sure no English text is left behind?
- [x] Unit tests: every language has every key, no empty value, the same `{placeholders}` as English, and every error `code` the API can send has a text. A new ui.md rule with its check: no text literals in JSX outside `i18n` (a grep in the test suite). Playwright walks the main screens in French and fails on a list of English words that must not appear ("Save", "Cancel", "Total", "Paid by"…). (Recommended)
- [ ] Only the key and placeholder unit tests.

### Q8. What do the checks cover in each language?
- [x] French gets the full walk (Login → My trips → trip view → add and edit expense with a field error → Balances → Mark as paid → Settings), with screenshots of the tightest screens. Spanish gets a shorter walk (Login, trip view, add form with a `sum_mismatch` error, Settings). English stays covered by every earlier check. (Recommended)
- [ ] The full walk in both Spanish and French.

- [x] Round 3 answered (tick this when you have answered every question above)

## Decisions made while writing the specification

Round 3 answers: every recommendation was kept. These details were settled in
`specs/06-translations-specification.md` and can be challenged there:

- **Error texts are keyed by form, field and code** (`error.expense.name.required`), not by code alone: the API uses
  the same code with different wording per form ("Enter a name for the expense." / "… for the trip." / "Enter your
  name."; `too_long` for 120, 80, 60 or 200 characters). Person ids and row numbers are dropped from the field
  (`paid_by.12` → `paid_by.person`). Fallbacks: `error.{code}`, then the API's English `message`.
- **The texts the checks rely on are fixed in the spec** (two tables in Screens), drafted for 390 px: shorter labels
  where a layout cannot wrap ("+ Gasto", "+ Dépense", "Marquer payé", "Marcar pagado", "Déconnexion"). The native-speaker
  review (Round 1 Q8) may change them; the checks are then updated with the review.
- **Spanish "0 gastos" vs French "0 dépense":** Spanish uses the plural for 0, French the singular (Round 1 Q7).
- **French category keywords** are listed in Data, with "total" and "air" deliberately left out ("Essence Total" is
  Fuel through "essence"; "Air France" is a brand entry). Check 17 covers them.
- **Check accounts:** Olga's token for the `PATCH /me` API check, so Hugo stays French for the category check; Hugo's
  trip "Even split" for the network error, because Madrid is paid and Ana's account is no longer English by then.
- **`YourNameScreen` is replaced by `SettingsScreen`**, and the `yourName.*` keys become `settings.*`.
