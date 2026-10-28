Travel notebook: cool blue-grey paper, one blue accent (kept clear of the green/red used for money), big tap targets, balances shown with a clear sign. Phone first: expenses are added on the go, at the restaurant table or the ticket counter, often by one person for others.

# UI guidelines

## Tokens (only in `packages/app/src/theme.ts`)
- Colour: `paper #F3F6FA`, `surface #FFFFFF`, `ink #1F2933`, `inkMuted #5B6B7B`, `line #D9E2EC`, `accent #1F5FBF` (blue), `accentSoft #DCE8F8`, `onAccent #FFFFFF`, `owed #2E6B3E`, `owes #A6321C`, `owesSoft #FBE6E0`. `owed`/`owes`/`owesSoft` are for amounts and errors only.
- Spacing (`space`): `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`, `xxl 32`.
- Radius (`radius`): `sm 8`, `md 14`, `pill 999`.
- Type scale (`typeScale`): `caption 13`, `body 16`, `title 20`, `display 28`, `hero 44`. The font is the platform default.
- Sizes (`size`): `tapMin 48`, `tapPrimary 56`, `border 1`, `fieldWidth 120`, `suffixWidth 16`, `pageMaxWidth 520`, `statusBarInsetIos 50`, `statusBarInsetAndroid 24`.

## Rules (each line ends with its check)
1. No raw hex outside `theme.ts`. Check: `grep -rnE "#[0-9A-Fa-f]{3,8}\b" packages/app/src --exclude=theme.ts` finds nothing.
2. No raw pixel values in styles. Check: `margin*`, `padding*`, `gap`, `width`, `height`, `*Width`, `*Radius` and `fontSize` take only token references (`0`, `StyleSheet.hairlineWidth` and `flex` ratios allowed).
3. No gradients and no purple. Check: no `gradient` in `packages/app/src`; no colour token with a hue between 250° and 320°.
4. Left-aligned by default. Check: `textAlign: "center"`, and `alignItems: "center"` in a column, appear only in TabBar, buttons, loading/error states (`StateMessage`) and the page wrapper that centres the app column on wide screens (`alignItems: "center"` in a row is vertical alignment and allowed).
5. Big tap targets. Check: every `Pressable` has `minHeight` of at least `size.tapMin`; the primary action (Save expense, Save changes, Mark as paid, + Add expense) uses `size.tapPrimary` and sits at the bottom of the screen.
6. Balances never rely on colour alone. Check: net amounts use `formatSignedCents` (always + or −).

## Components (`packages/app/src/components`)
`Card`, `Chip`, `FieldError`, `Money`, `StateMessage`, `TabBar`, `TextField`. Screens: `LoginScreen`, `SignUpScreen`, `MyTripsScreen`, `NewTripScreen`, `YourNameScreen`, `TripScreen`, `BalancesScreen`, `AddExpenseScreen` (also edits an expense), `MarkPaidScreen` (the trip's tabs and its overlays live in `TripView.tsx`).
