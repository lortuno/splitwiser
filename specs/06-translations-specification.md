# Epic 6: Translations (English, Spanish, French) — specification

Source: new feature (not in `specs/roadmap.md`). Brainstorming: `specs/06-translations-brainstorming.md` (rounds 1–3;
every recommendation was kept). Boundaries: `specs/guidelines/architecture.md`, `specs/guidelines/ui.md`.

## Estimate

Development hours only, as defined in "Estimates" in AGENTS.md. Rows are append-only.

| Date | Task | Estimate (h) | Actual (h) |
|---|---|---|---|
| 2026-10-28 | Build the epic | 2 | 0.33 |

## Goal

Every text the app writes can be shown in English, Spanish or French. A new account starts in English. A person
switches the language on Login, Sign up or the new "Settings" screen, and the whole app changes at once. **Every switch
is recorded in the database** (`users.language`) and the account's language is the source of truth: each time the app
starts with a session, it starts in the language stored for that account. On the web the last language is also kept
on the device, so Login already appears in it.

The translations live in one TypeScript file per language inside the project and are kept **small and maintainable**:
one key per distinct text, never two keys with the same text; anything that varies (names, amounts, dates, counts,
limits) is a `{placeholder}` in a single key rather than a separate key per variant; no unused keys. The type check and
the tests enforce these rules. API errors are worded by the app from their `code` and `params`, so the API stays
English-only. Amounts keep one format ("1.234,56 €") in all languages; month names are translated. No new package,
service or dependency.

## Screens

All buttons are at least `size.tapMin` (48 px) high. Primary buttons are `size.tapPrimary` (56 px) high and sit at the
bottom. Visible layout changes happen only on Login, Sign up, the "My trips" header and "Settings"; every other screen
shows its text in the chosen language with no layout change.

**Language control** (new component `LanguagePicker`, `src/components`): a three-part segmented control styled like
"How to split" (each part `size.tapMin` high, selected part `accent` with `onAccent` text, `accessibilityRole="radio"`
with `aria-checked`). The parts always read "English", "Español", "Français", whatever the current language.

### Login and Sign up (`LoginScreen`, `SignUpScreen`, changed)

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
│ [English] [Español] [Français]       │  LanguagePicker, 48 high
│                                      │
│            (flexible space)          │
│ ┌──────────────────────────────────┐ │
│ │              Log in              │ │  primary, 56 high, bottom
│ └──────────────────────────────────┘ │
│      No account yet? Sign up         │
└──────────────────────────────────────┘
```

- **LanguagePicker** under the form (on Sign up under the password field): tapping a language switches every text on
  the screen at once, without a reload, and keeps the choice on the device (web). Field values and errors already on
  screen stay; their texts switch language.
- **Log in / Create account:** as today. Before login there is no account to record the language on, so a language
  picked on this screen during this visit is recorded in the database right after login (`PATCH /me { language }`)
  or with the sign-up (`POST /auth/signup { …, language }`). Without such a pick, the account's stored language applies
  after login and is copied to the device.
- Loading and error states: as today, translated ("Could not reach the API at {url}.", "Email or password is wrong.").

### My trips header (`MyTripsScreen`, changed)

```
┌──────────────────────────────────────┐
│ My trips            Settings Log out │  "Your name" becomes "Settings"
├──────────────────────────────────────┤
```

- **Settings** (header button, `size.tapMin`): opens "Settings". The title still shrinks first ("…") when the buttons
  need the room.

### Settings (`SettingsScreen`, replaces `YourNameScreen`)

```
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

- **Name and Save:** exactly as "Your name" today (`PATCH /me { display_name }`, "Saving…", field errors, back to My
  trips on success).
- **Language:** tapping a language switches the app at once and records it right away with `PATCH /me { language }`,
  without "Save". While the request runs the control is disabled. When it fails, the switch is undone (the app and the
  control go back to the stored language) and "Could not reach the API at {url}." (owesSoft card) appears under the
  control, so the app never shows a language the database does not have. Tapping again retries.
- **‹ My trips:** back without saving the name.

### Text that must fit at 390 px

Translations must fit the existing layouts: labels may wrap to a second line where the layout already allows it
(split segments, chips, cards, hints); where it does not (tab bar, header buttons, primary buttons), the wording is
shorter. The French and Spanish texts the checks rely on are fixed below; the build drafts the rest.

| Key | English | Español | Français |
|---|---|---|---|
| `auth.appName` | Travel expenses | Gastos de viaje | Frais de voyage |
| `auth.loginIntro` | Log in to see your trips. | Inicia sesión para ver tus viajes. | Connectez-vous pour voir vos voyages. |
| `auth.logIn` | Log in | Iniciar sesión | Se connecter |
| `auth.toSignUp` | No account yet? Sign up | ¿Aún no tienes cuenta? Regístrate | Pas encore de compte ? S’inscrire |
| `trips.title` | My trips | Mis viajes | Mes voyages |
| `trips.settings` | Settings | Ajustes | Paramètres |
| `trips.logOut` | Log out | Cerrar sesión | Déconnexion |
| `trip.back` | ‹ My trips | ‹ Mis viajes | ‹ Mes voyages |
| `common.markPaid` | Mark as paid | Marcar pagado | Marquer payé |
| `common.cancel` / `common.save` / `common.saving` | Cancel / Save / Saving… | Cancelar / Guardar / Guardando… | Annuler / Enregistrer / Enregistrement… |
| `trip.totalSpend` | Total trip spend | Gasto total del viaje | Total des dépenses |
| `trip.expenseCount` (0 / 1 / 20) | 0 expenses / 1 expense / 20 expenses | 0 gastos / 1 gasto / 20 gastos | 0 dépense / 1 dépense / 20 dépenses |
| `trip.peopleCount` (4) | 4 people | 4 personas | 4 personnes |
| `balances.transfers` | Who owes whom | Quién debe a quién | Qui doit à qui |
| `balances.pays` | {from} pays {to} | {from} paga a {to} | {from} paie {to} |
| `common.balances` (tab and heading) | Balances | Saldos | Soldes |
| `tabs.trip` / `tabs.add` | Trip / + Add expense | Viaje / + Gasto | Voyage / + Dépense |
| `add.title` / `edit.title` | Add expense / Edit expense | Nuevo gasto / Editar gasto | Nouvelle dépense / Modifier la dépense |
| `add.save` / `edit.save` | Save expense / Save changes | Guardar gasto / Guardar cambios | Enregistrer / Enregistrer les modifications |
| `add.fixErrors` | Please fix the fields marked in red. | Corrige los campos marcados en rojo. | Corrigez les champs en rouge. |
| `common.paid` / `trip.paidBy` | ✓ Paid / Marked as paid by {name} on {date}. | ✓ Pagado / Marcado como pagado por {name} el {date}. | ✓ Payé / Marqué comme payé par {name} le {date}. |
| `markPaid.title` | Mark this trip as paid? | ¿Marcar este viaje como pagado? | Marquer ce voyage comme payé ? |
| `settings.title` / `settings.language` | Settings / Language | Ajustes / Idioma | Paramètres / Langue |
| `common.loadFailed` | Could not reach the API at {url}. | No se pudo conectar con la API en {url}. | Impossible de joindre l’API à {url}. |
| `month.6` / `month.10` | Jun / Oct | jun / oct | juin / oct. |
| `category.*` | Food, Groceries, Drinks, Coffee, Fuel, Transport, Flights, Lodging, Activities, Shopping, Other | Comida, Supermercado, Bebidas, Café, Gasolina, Transporte, Vuelos, Alojamiento, Actividades, Compras, Otros | Repas, Courses, Boissons, Café, Carburant, Transport, Vols, Logement, Activités, Shopping, Autre |

Error texts: the complete list, one key per error, with dynamic values as placeholders (see "Error texts" in Data).
The English wording of some errors becomes the shared one; "Was" lists the texts each key replaces.

| Key | English | Español | Français | Was |
|---|---|---|---|---|
| `error.required` | Fill in this field. | Rellena este campo. | Remplissez ce champ. | Enter a name for the expense. / … for the trip. / Enter a name. / Enter your name. / Enter your email. |
| `error.choosePerson` | Choose at least one person. | Elige al menos una persona. | Choisissez au moins une personne. | Choose who paid. / Choose who shares this expense. / Choose a person. |
| `error.tooLong` | Use at most {max} characters. | Usa como máximo {max} caracteres. | {max} caractères maximum. | 4 texts (120, 80, 60, 200) |
| `error.tooShort` | Use at least {min} characters. | Usa al menos {min} caracteres. | {min} caractères minimum. | Use at least 8 characters. |
| `error.invalidDate` | Enter a date as YYYY-MM-DD. | Escribe una fecha como AAAA-MM-DD. | Saisissez une date au format AAAA-MM-JJ. | 3 identical texts |
| `error.beforeStart` | The end date is before the start. | La fecha de fin es anterior al inicio. | La date de fin précède le début. | — |
| `error.invalidAmount` | Enter an amount greater than 0. | Escribe un importe mayor que 0. | Saisissez un montant supérieur à 0. | 3 identical texts |
| `error.tooLarge` | The amount is too large. | El importe es demasiado alto. | Le montant est trop élevé. | — |
| `error.invalidEmail` | Enter an email like {example}. | Escribe un correo como {example}. | Saisissez un e-mail comme {example}. | 2 identical texts |
| `error.taken` | This email already has an account. | Este correo ya tiene una cuenta. | Cet e-mail a déjà un compte. | — |
| `error.alreadyOnTrip` | This is already on the trip. | Ya está en el viaje. | Déjà dans ce voyage. | This name is … / This email is already on the trip. |
| `error.tooFew` | Add at least one more person. | Añade al menos una persona más. | Ajoutez au moins une autre personne. | — |
| `error.tooMany` | A trip can have at most {max} people. | Un viaje puede tener como máximo {max} personas. | Un voyage peut compter {max} personnes au maximum. | — |
| `error.sumMismatch` | Amounts add up to {sum} but the expense is {amount}. | Los importes suman {sum} pero el gasto es de {amount}. | Les montants font {sum} mais la dépense est de {amount}. | Paid amounts … / Split amounts … |
| `error.percentMismatch` | Percentages add up to {sum} instead of {total}. | Los porcentajes suman {sum} en lugar de {total}. | Les pourcentages font {sum} au lieu de {total}. | — |
| `error.invalid` | Check this field. | Revisa este campo. | Vérifiez ce champ. | codes the screens cannot cause (`not_a_member`, expense `duplicate`, `invalid_type`, `invalid_category`, `invalid_language`) |

Errors that already have an app text keep it, with no new key: `invalid_credentials` → `auth.wrongCredentials`,
`trip_paid` → `add.tripPaid`, split `invalid_value` → `error.invalidAmount` / `add.invalidPercent` /
`add.invalidShares` (by split type). `already_paid` and `already_open` show no text (the trip view reloads).

French uses a narrow no-break space before "?" and ":" where typography requires it ("compte ? S’inscrire").

## Data

**Schema** (`packages/api/src/Database/Schema.php`): new column `users.language TEXT NOT NULL DEFAULT 'en' CHECK
(language IN ('en', 'es', 'fr'))` in `CREATE TABLE users`, and in `ADDED_COLUMNS` (epic 5), so existing databases get
it and existing accounts become English. The demo accounts stay English (no seed change).

**API writes:** `PATCH /me` updates `display_name` and/or `language`; `POST /auth/signup` stores `language` (default
`en`). **API reads:** the user object carries `language`.

**Translation files** (`packages/app/src/i18n`):

- `en.ts` (the keys), `es.ts` and `fr.ts`, each `Record<MessageKey, string>`, so a missing or extra key fails `tsc`.
  `index.ts` holds the current language, `setLanguage(lang)`, `getLanguage()`, and a subscription that re-renders the
  app (`App.tsx` keeps the language in state and passes it down via a React context; no library).
- **Plurals:** `tCount` uses each language's rule: English and Spanish use ".one" for exactly 1; French for 0 and 1.
- **Dates:** `formatDate` keeps "day month year" with the language's month abbreviations (fr: janv., févr., mars,
  avr., mai, juin, juil., août, sept., oct., nov., déc.; es: ene, feb, mar, abr, may, jun, jul, ago, sept, oct, nov,
  dic).
- **Money:** `src/money/format.ts` is unchanged in every language.
- The web page's `<html lang>` follows the language (`en`, `es`, `fr`).

**Translation rules** (a new "Translations" section in `specs/guidelines/ui.md`, each rule with its check in
`tests/unit/i18n`). The goal is the fewest keys that still read naturally in every language:

1. **One key per distinct text.** No two keys in `en.ts` have the same English value. Texts used on several screens
   live under `common.*` (`common.cancel`, `common.save`, `common.saving`, `common.markPaid`, `common.paid`,
   `common.balances`, `common.loadFailed`, `common.name`). This merges today's duplicates: `add.cancel` +
   `markPaid.cancel`, `add.saving` + `yourName.saving`, `trip.markPaid` + `markPaid.confirm`, `trip.paid` +
   `trips.paid`, `tabs.balances` + `balances.title`, `newTrip.personName` + `yourName.name`, and `auth.name` +
   `trips.yourName` + `yourName.title` (the last two disappear with "Settings"). Check: a test fails on duplicate
   English values; an exception needs an entry in a short allow-list with a reason (the list starts empty).
2. **Dynamic values are placeholders in one key.** Names, amounts, dates, counts and limits are `{placeholders}`
   (`"Use at most {max} characters."`), never one key per value and never a sentence glued from several keys. Counts use
   `tCount` with the `.one` variant only. Check: the placeholder test below; a grep finds no `t(…) + t(…)` or template
   strings joining two `t()` calls.
3. **No unused keys.** Every key in `en.ts` is used in `packages/app/src`. Keys built at run time are declared once by
   prefix (`category.*`, `month.*`, `error.*` codes, `split.*`, `*.one`). Check: a test fails on keys no source file
   uses.
4. **Same keys, same order, same placeholders.** `es.ts` and `fr.ts` are typed `Record<MessageKey, string>` (a missing
   or extra key fails `tsc`), list the keys in `en.ts` order, have no empty value, and keep exactly the English
   `{placeholders}`. Check: unit tests.
5. **No text outside the translation files.** Screens and components contain no text literals in JSX (numbers, "›",
   "‹", "✓", "×", "%" and input placeholders like "0,00" are allowed). Check: a grep test over `packages/app/src`.
6. **Keys are grouped by screen** (`auth.*`, `trips.*`, `trip.*`, `add.*`, `settings.*`, …) plus `common.*` and
   `error.*`, so a translator sees each screen's texts together.

**Error texts:** the app shows its own text for every API error and never the API's `message`, except as the last
fallback for a code it does not know. One small mapping (`src/i18n/errors.ts`) turns an error's `code` (and, only
where needed, its field) into one of the `error.*` keys in the Screens table, filling the placeholders from `params`:

- `required` → `error.required`, except on the person-choice fields `paid_by`, `split` and `recorded_by` →
  `error.choosePerson`;
- `too_long` → `error.tooLong` with `{max}`; `too_short` → `error.tooShort` with `{min}`; `too_many` →
  `error.tooMany` with `{max}` (all from `params`);
- `duplicate` and `duplicate_email` on a trip's people → `error.alreadyOnTrip`;
- `sum_mismatch` → `error.sumMismatch` with `{sum}` and `{amount}` formatted by `formatCents`, or, for a percentage
  split, `error.percentMismatch` with `{sum}` and `{total}` formatted by `formatBasisPoints`;
- `invalid_email` → `error.invalidEmail` with `{example}` = "ana@example.com";
- every other code as listed in the Screens table.

A network failure in the expense form shows `common.loadFailed` ("Could not reach the API at {url}.") instead of the
raw "TypeError: Failed to fetch".

**Category keywords (epic 5):** `CategoryKeywords` gains French words and brands, each in one category, at least:
dîner, déjeuner, phrase "petit dejeuner", repas → `food`; courses, supermarché, Carrefour (exists), Intermarché,
Leclerc → `groceries`; bière, vin, apéro → `drinks`; boulangerie, croissant, glace → `coffee`; essence, carburant,
gazole, TotalEnergies → `fuel` ("total" alone stays in no list); péage, autoroute, navette, SNCF, TGV → `transport`;
vol, vols, Air France → `flights` ("air" alone stays in no list); hôtel (exists as "hotel"), gîte, logement → `lodging`;
musée, billets, entrée, visite guidée → `activities`; pharmacie, cadeau, cadeaux, vêtements → `shopping`. The guess
itself does not depend on the app's language.

**The database is the source of truth.** Every switch made while logged in is written to `users.language` before
the app shows it as chosen (Settings undoes a switch that could not be saved). At every start with a session, the
app loads `GET /me` and switches to the account's language before showing "My trips" or a trip. The device copy only
covers the moments without an account:

- **Web:** the language is kept under `travel-expenses.language` in `localStorage` (read and written in try/catch,
  like the token). It is used for the loading state at start and for Login and Sign up, and is overwritten with the
  account's language after every start and login. When storage is blocked, Login starts in English.
- **iOS and Android:** nothing is kept on the device (no storage dependency, as for the session token), so a cold
  start opens Login in English; the account's language applies right after login.
- A language picked on Login or Sign up during this visit is recorded on the account at login (see Screens); without
  such a pick the stored language wins.

## API

Errors keep the existing shapes. No money changes.

| Request | Response |
|---|---|
| `GET /me`, `POST /auth/login`, `POST /auth/signup` | The user object gets `language` (`en`, `es` or `fr`). |
| `POST /auth/signup` | Body gains an optional `language`; missing → `en`. |
| `PATCH /me` | Body `{ display_name?, language? }`. Each is validated when present; a body with neither gives `422 display_name required`, as today. `200` with the user. |
| All endpoints with field errors | Errors whose text has a dynamic value gain `params`, so the app's single key can fill it: `sum_mismatch` on `paid_by` and on an exact `split` → `{ "sum_cents", "amount_cents" }`; `sum_mismatch` on a percentage `split` → `{ "sum_basis_points", "total_basis_points" }`; `too_long` → `{ "max" }`; `too_short` → `{ "min" }`; `too_many` → `{ "max" }`. Every other error has no `params`. The `message` stays English. |

New error: `422` on the field `language`, code `invalid_language`, message "Choose English, Spanish or French.", for
any value that is not `en`, `es` or `fr` (on `PATCH /me` and `POST /auth/signup`).

## Seed data

No seed changes: trips 1–8, their expenses and the 10 accounts stay as they are, and every account starts in English.
The checks switch languages through the app. The figures they use are the existing ones (pinned by `FixtureTest`):

- Trip 1 "Lisbon & Porto": total `1.915,57 €`, 20 expenses, 4 people; Ana pays Ben `63,75 €`, David pays Ben `27,65
  €`, David pays Chloé `27,07 €`.
- Trip 7 "Madrid weekend": total `78,30 €`; Ana paid `30,00 €`, share `39,15 €`, net `-9,15 €`; Chloé paid `48,30 €`,
  share `39,15 €`, net `+9,15 €`; Ana pays Chloé `9,15 €`.
- Trip 2 "Empty weekend" (Eva): `0,00 €`, 0 expenses, 3 people. Trip 4 "Three-way taxi" (Jon): 1 expense.
- The `sum_mismatch` check enters an expense of `50,00 €` paid by Ana `20,00 €` and Ben `25,00 €` on trip 1, which is
  refused, so no figure changes.

## Tests

- **PHP (`packages/api/tests`, run through `tests/functional`):** `users.language` is added to an existing database and
  defaults to `en`; `PATCH /me` with `language` alone, with both fields, with an invalid value (`invalid_language`) and
  with neither; sign-up with and without `language`; `language` in `GET /me`, login and sign-up responses; `params` on
  each `sum_mismatch`, `too_long`, `too_short` and `too_many`, and none on other errors; about 25 French entries added to the epic 5 fixture list (every word listed in Data, plus
  "Dîner au restaurant" → food, "Essence Total" → fuel, "Péage autoroute" → transport, "Total" → other), all exact.
  Existing tests still pass, apart from the new fields.
- **TypeScript (`tests/unit/i18n`):** one test per translation rule in Data: no duplicate English values (allow-list
  empty), no unused keys, no sentence glued from two `t()` calls, same keys in the same order with no empty value and
  the same `{placeholders}` in every language, no text literals in JSX outside `i18n`. Also: plural rules (fr 0 →
  singular); `formatDate` per language; the error mapping (each API code to its key, `choosePerson` on person fields,
  `params` filled and formatted, unknown code → API `message`); the language store (DB language applied at start,
  device copy overwritten, storage blocked → English on Login, "picked this visit" flag); Settings undoes a switch that
  could not be saved; `updateMe` and `signUp` send `language`.
- **Playwright (`tests/e2e`, 390x844):** a new `translations.test.ts` with one screenshot per 📸 check, on a fresh
  seed, in the order of the checks. The French walk fails when any of these English texts appears: "Save", "Cancel",
  "Paid by", "Recorded by", "Who owes whom", "Balances", "expenses", "people", "Settings", "Log out", "Mark as paid",
  "Add expense". Earlier suites change only where they pinned a replaced text: epic 4 check 17 and epic 5 check 13 now
  expect "Could not reach the API at {url}." in the expense form; "Enter a name for the expense.", "Enter a name for
  the trip." and "Enter your name." become "Fill in this field."; "This name is already on the trip." and "This email
  is already on the trip." become "This is already on the trip.". Texts whose words stay the same through a
  placeholder ("Use at most 80 characters.", "Use at least 8 characters.") are unchanged.

## Acceptance checks

Viewport 390x844. Freshly seeded database. App at http://localhost:8081. Every demo password is `travel-demo-2026`.
"Fresh browser" means a new browser profile with nothing stored. Run the checks in order: checks 3–10 build on each
other. "{today}" is the local date of the check in the language shown ("28 oct. 2026", "28 oct 2026").

1. 📸 **Login starts in English.** Fresh browser, open the app. Login reads "Travel expenses", "Log in to see your
   trips." and shows the language control "English | Español | Français" under the password field, each part at least
   48 px high, with "English" selected. The page's `lang` is `en`.
2. 📸 **Switch Login to French.** Tap "Français". Without a reload the screen reads "Frais de voyage", "Connectez-vous
   pour voir vos voyages.", "Se connecter" and "Pas encore de compte ? S’inscrire"; "Français" is selected and the page's
   `lang` is `fr`. Reload the page: it is still French.
3. **Log in in French.** Log in as `ana@example.com`. "Mes voyages" shows the header buttons "Paramètres" and
   "Déconnexion", and the cards "Madrid weekend" and "Lisbon & Porto" with their totals. In the console, `GET /me`
   answers `language: "fr"` (the pick on Login was saved to the account).
4. 📸 **Trip view in French.** Open "Lisbon & Porto". The header shows "‹ Mes voyages" and "Marquer payé" on one row.
   The screen reads "Total des dépenses", `1.915,57 €`, "1 juin 2026 – 7 juin 2026 · 20 dépenses", "4 personnes", "Qui
   doit à qui", "Ana paie Ben `63,75 €`", "David paie Ben `27,65 €`", "David paie Chloé `27,07 €`"; the tab bar reads
   "Voyage", "Soldes" and "+ Dépense". The row "Taxi to Porto airport" reads "7 juin 2026 · Payé par David" and its
   accessible name starts with "Transport, Taxi to Porto airport". None of the English texts listed in Tests appear,
   and the page does not scroll sideways.
5. 📸 **Add form and field errors in French.** Open "Madrid weekend" and tap "+ Dépense". The form reads "Nouvelle
   dépense", "Annuler", the category chips "Repas … Autre", the split options, and "Enregistrer" at the bottom; every
   split option and chip is at least 48 px high. Tap "Enregistrer" with the form empty: "Remplissez ce champ." (name),
   "Saisissez un montant supérieur à 0." and "Choisissez au moins une personne." (Payé par) appear, with "Corrigez les
   champs en rouge." above the button. Tap "Annuler".
6. **Edit form in French.** Tap "Tapas at Mercado de San Miguel": "Modifier la dépense" opens with "Enregistrer les
   modifications" at the bottom and "Repas" selected. Tap "Annuler": the total is still `78,30 €`.
7. 📸 **Balances and Mark as paid in French.** Tap "Soldes": Ana shows `-9,15 €` with "Payé `30,00 €`" and "Part
   `39,15 €`", Chloé `+9,15 €`, and "Ana paie Chloé `9,15 €`". Tap "Voyage", then "Marquer payé": the confirmation reads
   "Marquer ce voyage comme payé ?" and lists "Ana paie Chloé `9,15 €`". Confirm: the card reads "✓ Payé" and "Marqué
   comme payé par Ana le {today}.", and the header shows the French for "Reopen".
8. 📸 **Settings in French, switch to Spanish.** Tap "‹ Mes voyages", then "Paramètres". The screen reads "Paramètres",
   the name field with "Ana", "Langue" with "Français" selected, and "Enregistrer". Tap "Español": without "Enregistrer"
   the screen reads "Ajustes", "Idioma" and "Guardar", and in the console `GET /me` answers `language: "es"`. Reload:
   still Spanish. **The database decides at start:** in the console, with Ana's token, `PATCH /me { "language": "fr" }`,
   then reload: the app starts in French although this browser last showed Spanish. `PATCH /me { "language": "es" }`
   and reload: Spanish again.
9. **The account's language follows Ana.** Fresh browser: Login is in English. Log in as Ana: "Mis viajes" appears
   in Spanish. Log out ("Cerrar sesión"): Login now reads "Iniciar sesión" (the account's language was copied to the
   device).
10. **A pick on Login wins.** Fresh browser, tap "Français" on Login and log in as Ana (account in Spanish): the app is
    French, and `GET /me` answers `language: "fr"`.
11. 📸 **Spanish walk with a sum error.** Fresh browser, tap "Español" and log in as `ben@example.com`. Open "Lisbon &
    Porto": "Gasto total del viaje", `1.915,57 €`, "Ana paga a Ben `63,75 €`". Tap "+ Gasto", enter the name "Cena",
    the amount `50,00`, choose Ana and Ben under "Pagado por" with `20,00` and `25,00`, and tap "Guardar gasto": "Los
    importes suman `45,00 €` pero el gasto es de `50,00 €`." appears and nothing is saved. Tap "Cancelar", then
    open "Ajustes": "Español" is selected.
12. **Sign up in French.** Fresh browser, tap "Français", then "Pas encore de compte ? S’inscrire". The sign-up form is
    French. Sign up as "Lena" with `lena@example.com` and `travel-demo-2026`: "Mes voyages" appears in French and `GET
    /me` answers `language: "fr"`. Log out, open sign-up again and use `ana@example.com`: "Cet e-mail a déjà un
    compte." appears.
13. **Plurals.** As `eva@example.com` in French (switch on Login), "Empty weekend" reads "0 dépense" and "3
    personnes"; in Spanish (switch in "Ajustes") it reads "0 gastos" and "3 personas". As `jon@example.com` in French,
    "Three-way taxi" reads "1 dépense".
14. 📸 **Saving the language fails, nothing changes.** As `hugo@example.com` (English), open "Settings" and block the
    API. Tap "Français": the switch is undone, the screen stays English with "English" selected, and "Could not reach
    the API at http://localhost:8080." appears under the control. Unblock the API and tap "Français" again: the screen
    is French and `GET /me` answers `language: "fr"`. Tap "English": English again, `language: "en"`.
15. **Network error in the expense form.** As Hugo in English on "Even split", open "+ Add expense", enter a name,
    `10,00` and "Paid by" Hugo, block the API and tap "Save expense": "Could not reach the API at
    http://localhost:8080." appears above the button and the input stays. Unblock, switch to French in Settings, and
    repeat on "Even split": "Impossible de joindre l’API à http://localhost:8080.".
16. **API.** In the console with Olga's token (`olga@example.com`): `PATCH /me { "language": "de" }` answers `422` with
    `errors.language.code` `invalid_language`; `{ "language": "es" }` answers `200` with `language: "es"` and the name
    unchanged; `{}` answers `422` with `errors.display_name.code` `required`. `POST /auth/signup` with `language: "fr"`
    returns a user with `language: "fr"`, without it `language: "en"`. With Ana's token, `POST /trips/1/expenses` with
    `amount_cents` 5000 paid `2000` + `2500` answers `422` with `errors.paid_by.params` `{ "sum_cents": 4500,
    "amount_cents": 5000 }`; a percentage split of 50 % + 40 % answers `errors.split.params` `{ "sum_basis_points": 9000,
    "total_basis_points": 10000 }`. With Olga's token, `PATCH /me` with a 61-character `display_name` answers
    `errors.display_name` with code `too_long` and `params` `{ "max": 60 }`.
17. **French category suggestions.** As Hugo (French since check 15) on "Even split", tap "+ Dépense" and type,
    waiting a second each time: "Dîner au restaurant" selects "Repas"; "Essence Total" selects "Carburant"; "Péage
    autoroute" selects "Transport"; "Total" selects "Autre". Tap "Annuler".
18. **Earlier epics still hold.** With a fresh seed, the epic 1–5 checks pass in English with the same figures; where
    they pinned an error text that is now shared, they show the shared wording listed in Tests.
19. **A maintainable translation repository.** The unit tests for the translation rules pass: `en.ts` has no two keys
    with the same text, no unused key, and no sentence built from two keys; `es.ts` and `fr.ts` have exactly the keys of
    `en.ts`, in the same order, with the same placeholders; no screen contains a text literal. The error keys are the 16
    `error.*` keys of the Screens table, and the 7 groups of duplicate texts in today's `en.ts` are merged into
    `common.*` keys.

## Out of scope

Excluded in the rounds: more languages, following the device's language, API-side translation (`Accept-Language`),
English API errors shown as they are, a language button in the "My trips" header, saving the language with "Save",
`adjustsFontSizeToFit`, a `user_settings` table, a separate language endpoint, `params` on every error, seeding an
account in another language, a storage dependency for iOS and Android (`AsyncStorage`), and the full walk in Spanish.
Also not included: translating what people typed (trip, expense and people's names), language-specific money formats
(French "1 234,56 €"), right-to-left languages, and translating API responses used by tools (`message` stays English).
**Release step, not a build step:** a Spanish and a French speaker review `es.ts` and `fr.ts` before release; the
build's texts are a draft (checks that pin a text are updated with the review).

## Check on iOS and Android

- The language control and all French and Spanish labels fit at the largest accessibility text size; header buttons
  and the tab bar do not overlap.
- Switching language on Login, then logging in, keeps the language; a cold start before login shows English, and the
  account's language applies after login.
- VoiceOver and TalkBack read French and Spanish screens with the right voice (the language reaches the accessibility
  layer), including the translated row labels.
- Typographic characters (’ « » and the narrow no-break space before "?") render in the platform font.
- Both platforms still build: Expo export for `ios` and `android` succeeds in the container.
