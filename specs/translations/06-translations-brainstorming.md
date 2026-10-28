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
`specs/translations/06-translations-specification.md` and can be challenged there:

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

## Changes after review (2026-10-28)

The user asked for two changes after reading the specification; the specification was updated to match:

1. **As few translations as possible, in a maintainable repository.** One key per distinct text; a dynamic value is a
   `{placeholder}` inside a single key, never one key per variant. This replaces the first decision above: error
   texts are no longer keyed by form, field and code but by code (16 `error.*` keys; a field decides only between
   `error.required` and `error.choosePerson`), with `params` from the API for every value (`max`, `min`, `sum_cents`,
   `amount_cents`, `sum_basis_points`, `total_basis_points`). Some English error wording becomes shared ("Fill in this
   field.", "This is already on the trip."), and earlier checks that pinned the old wording are updated. Today's 7
   groups of duplicate texts merge into `common.*` keys. Six translation rules, each with a test, go into
   `specs/guidelines/ui.md`: no duplicate values, placeholders instead of variants or glued sentences, no unused keys,
   same keys/order/placeholders in every language, no text in screens, keys grouped by screen. Check 19 covers them.
2. **Every language switch is recorded in the database, and the app starts in that language.** `users.language` is
   the source of truth: a switch in Settings is undone when it cannot be saved (check 14 changed accordingly), and
   every start with a session applies the stored language, even when the device last showed another one (check 8
   extended). Before login (no account yet) a pick on Login or Sign up is recorded at login. iOS and Android keep
   nothing on the device, so a cold start shows Login in English until the person logs in.

# Change: one menu at the top for the language, Settings and Log out

The user's request: "I want the language dropdown to be always visible in the top, not only inside settings. Also
settings and logout should be available in the dropdown, to simplify and not have too many things visible."

### What the specification says today

- **Language control** (`LanguagePicker`): a bordered dropdown button (`size.tapMin` high, `size.menuWidth` wide)
  showing "English ▾"; it opens a menu with "English", "Español", "Français". It sits at the top right of **Login**,
  on the "‹ Log in" row of **Sign up**, and under "Language" in **Settings**. No other screen has it.
- **My trips header:** `My trips            Settings Log out` (two text buttons, `size.tapMin`). These are the only
  places to open Settings and to log out (also in `specs/accounts/02-login-and-my-trips-specification.md`, Log out,
  and check 1 of `specs/accounts/07-admin-account-specification.md`: "The header shows "Settings" and "Log out"").
- **Settings:** name with "Save", plus "Language": a switch is saved at once with `PATCH /me { language }`; if that
  fails, the switch is undone and "Could not reach the API at {url}." appears under the control.
- **Trip view header:** `‹ My trips` on the left, "Mark as paid" / "Reopen" on the right; the add and edit forms have
  their title and "Cancel"; New trip and Settings have "‹ My trips".
- Checks that go through the current places: 06 checks 1, 3, 8, 9, 11, 13, 14, 15; 02 checks that tap "Log out";
  07 check 1. Data and API do not change: `PATCH /me { language }` and `POST /auth/logout` stay as they are.

## Round 4

### Q1. Where does the menu sit so it is always visible at the top?
- [x] A. One app bar, 48 high, on top of every screen, with the menu button at the right. Each screen keeps its own
  header below it, without "Settings" and "Log out" (Recommended: the same place everywhere, no crowding of the trip
  view's "‹ My trips" / "Mark as paid" row; costs 48 px of height on every screen)
- [ ] B. Inside each screen's own header row, at the right (no extra height, but a compact button next to "Mark as
  paid", "Cancel" etc., and a different position on screens without a header)

Option A at 390 px, My trips (correct it directly here if anything is wrong):

```
┌──────────────────────────────────────┐
│                        [English  ▾] │  app bar, 48 high, every screen
├──────────────────────────────────────┤
│ My trips                             │  header as today, without
│ Logged in as Ana                     │  "Settings" and "Log out"
│ ┌──────────────────────────────────┐ │
│ │ Lisbon & Porto        1.915,57 € │ │
│ └──────────────────────────────────┘ │
│            (flexible space)          │
│ ┌──────────────────────────────────┐ │
│ │            + New trip            │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

Option A, trip view:

```
┌──────────────────────────────────────┐
│                        [English  ▾] │  app bar
├──────────────────────────────────────┤
│ ‹ My trips              Mark as paid │  trip header as today
│ Lisbon & Porto                       │
│ Total spent                          │
│ 1.915,57 €                           │
│ ...                                  │
└──────────────────────────────────────┘
```

Option B, trip view:

```
┌──────────────────────────────────────┐
│ ‹ My trips      Mark as paid  [EN ▾] │
│ Lisbon & Porto                       │
└──────────────────────────────────────┘
```

### Q2. What does the closed button show?
- [x] The current language, as today: "English ▾", "Español ▾", "Français ▾" (Recommended: people still find the
  language where they expect it; accessible name "Menu, language: English")
- [ ] The language code: "EN ▾"
- [ ] A menu icon: "☰"

### Q3. What is in the open menu? (correct the wireframe directly here)
- [x] Languages first, then a line, then "Settings" and "Log out". Before login (Login, Sign up) only the three
  languages. On the Settings screen itself, "Settings" is left out of the menu (Recommended)
- [ ] The same, but "Settings" stays in the menu on the Settings screen, doing nothing
- [ ] Settings and Log out first, languages below

```
┌──────────────────────────────────────┐
│                        [English  ▾] │
│                       ┌────────────┐ │
│                       │ English    │ │  each row 48 high; the chosen
│                       │ Español    │ │  language accent with onAccent
│                       │ Français   │ │  text (radio)
│                       ├────────────┤ │
│                       │ Settings   │ │  opens Settings
│                       │ Log out    │ │  logs out, shows Login
│                       └────────────┘ │
│                                      │
```

Tapping a row, tapping outside the menu or Escape closes it, as today.

### Q4. Does "Settings" keep its own "Language" section?
- [ ] No: Settings keeps only the name and "Save"; the language is changed only from the menu (Recommended: one
  place for the language, fewer things on screen)
- [x] Yes: keep the dropdown in Settings as well

### Q5. Saving the language fails (logged in, API unreachable)
Today in Settings: the switch is undone and the error appears under the control.
- [ ] Same rule from the menu: the switch is undone, and "Could not reach the API at {url}." appears in an owesSoft
  card right under the app bar on whatever screen is open, until the next successful switch or the next screen
  (Recommended)
- [x] Keep the new language on screen and retry saving later (the database would no longer decide the language)

### Q6. Settings or Log out from a screen with unsaved input (add or edit expense, New trip, Settings name)
- [ ] Leave at once and drop the unsaved input, without asking, as "Cancel" and "‹ My trips" do today
  (Recommended)
- [x] Ask "Discard your changes?" first
- [ ] Hide "Settings" and "Log out" from the menu on those screens (only languages there)

### Q7. Which screens get the app bar?
- [x] Every screen: Login, Sign up, My trips, New trip, the trip view (Trip, Balances, the Mark as paid
  confirmation), the add and edit forms and Settings. Not the first "Loading…" while the app starts (Recommended)
- [ ] Only the screens after login, with Login and Sign up keeping today's picker in place

- [x] Round 4 answered (tick this when you have answered every question above)

## Round 5

Round 4 settled: one app bar on every screen but the first "Loading…" (Q1, Q7), the button shows "English ▾" (Q2),
the menu has the languages, then "Settings" and "Log out" (Q3), Settings keeps its own language dropdown (Q4). Q5 and
Q6 need details before they can go into the specification.

### Q1. Retrying a language that could not be saved (Round 4 Q5)
The specification says today that the database decides the language: every start with a session applies
`users.language` (check 8). A language kept on screen but not saved would be overwritten at the next start unless
the rule changes.
- [ ] The app keeps the unsaved language as "pending" (on the web also on the device) and sends it again with
  `PATCH /me { language }` at the next language switch, the next screen change and the next start. At a start with a
  pending language, the app sends it first; when that works, it wins over the stored one; when it still fails, the
  app shows the pending language anyway. The database decides only when nothing is pending (Recommended)
- [x] Retry only while the app stays open (next switch, next screen change). At the next start the database
  language applies and the unsaved pick is lost
- [ ] Retry every 30 seconds in the background while the app is open, plus the rule of the first option at start

### Q2. Does the person see that the language is not saved yet?
- [ ] Yes: a small owesSoft line under the app bar, "Language not saved yet. We will try again.", until a retry
  works (Recommended: otherwise a later start on another device shows the old language without explanation)
- [x] No message; retries are silent

### Q3. Settings' own language dropdown (kept in Round 4 Q4)
- [x] Same rule as the menu: a failed save keeps the language and retries; check 14 changes accordingly (Recommended:
  one rule for both controls)
- [ ] Keep today's rule in Settings only: the switch is undone and "Could not reach the API at {url}." appears

### Q4. When does "Discard your changes?" appear (Round 4 Q6)?
- [x] Only when the person taps "Settings" or "Log out" in the menu while a form has input that differs from how the
  form opened (add or edit expense, New trip, the name in Settings). An untouched form, and a language switch, never
  ask. "Cancel" and "‹ My trips" keep today's behaviour and do not ask (Recommended)
- [ ] The same, and "Cancel" and "‹ My trips" ask too
- [ ] Always ask on those screens, changed or not

### Q5. The "Discard your changes?" dialog at 390 px (correct it directly here)

```
┌──────────────────────────────────────┐
│                        [English  ▾] │
├──────────────────────────────────────┤
│ (the form, dimmed)                   │
│ ┌──────────────────────────────────┐ │
│ │ Discard your changes?            │ │  card, title 17 bold
│ │ What you entered on this screen  │ │
│ │ will be lost.                    │ │
│ │ ┌──────────────────────────────┐ │ │
│ │ │       Discard and log out    │ │ │  primary, 56 high; reads
│ │ └──────────────────────────────┘ │ │  "Discard and open Settings"
│ │ ┌──────────────────────────────┐ │ │  when Settings was tapped
│ │ │         Keep editing         │ │ │  secondary, 48 high
│ │ └──────────────────────────────┘ │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

- [x] As drawn: the button names the action ("Discard and log out" / "Discard and open Settings"); "Keep editing",
  tapping outside or Escape closes the dialog and keeps the input (Recommended)
- [ ] One "Discard" button for both cases, and "Keep editing"

- [x] Round 5 answered (tick this when you have answered every question above)

### Decisions made while changing the specification

Rounds 4 and 5 are in `specs/translations/06-translations-specification.md`, and also in
`specs/accounts/02-login-and-my-trips-specification.md` (Log out in the menu) and
`specs/accounts/07-admin-account-specification.md` (check 1). These details were settled there and can be challenged:

- **"Screen change" for the retry** is any change of route in `App.tsx` (opening a trip, a form, "Settings", going
  back). Only a network error or a `5xx` makes a language pending; a `401` ends the session and drops it; a newer
  switch replaces it.
- **The app bar is also on the start screen "Could not reach the API at {url}."**, with languages only, like Login.
- **"Settings" from the menu clears `?trip=`** on the web, and its "‹ My trips" leads to "My trips", as today.
- **"Unsaved input"** means any field differing from how the screen opened; changing a field back counts as
  unchanged. The "Mark as paid" confirmation has no input and never asks.
- **New keys** `menu.button`, `menu.logOut` (replaces `trips.logOut`) and `discard.*`; the menu's "Settings" row
  reuses `settings.title`. The Spanish and French drafts are in the Screens table, for the native-speaker review.
- **Checks:** 1, 3, 4, 8, 11, 13, 14, 15 and 18 changed; 20, 21 and 22 are new and use Noah, whom no other check
  touches. Check 18 keeps the epic 1 rule that the total and all three transfers of "Lisbon & Porto" are visible
  without scrolling, now below the app bar. In spec 02, checks 2 and 16; in spec 07, check 1.
