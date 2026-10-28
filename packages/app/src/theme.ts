// The only place for design values (see specs/guidelines/ui.md). Components reference these tokens,
// never raw hex values or pixel numbers.

export const colors = {
  paper: "#F3F6FA",
  surface: "#FFFFFF",
  ink: "#1F2933",
  inkMuted: "#5B6B7B",
  line: "#D9E2EC",
  accent: "#1F5FBF",
  accentSoft: "#DCE8F8",
  onAccent: "#FFFFFF",
  owed: "#2E6B3E",
  owes: "#A6321C",
  owesSoft: "#FBE6E0",
  /** Dims the screen behind a dialog ("Discard your changes?"): ink at 40 %. */
  backdrop: "rgba(31, 41, 51, 0.4)",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, md: 14, pill: 999 };

export const typeScale = { caption: 13, body: 16, title: 20, display: 28, hero: 44 };

export const size = {
  /** Minimum height of anything pressable. */
  tapMin: 48,
  /** Height of the primary action on a screen. */
  tapPrimary: 56,
  border: 1,
  /** Width of the per-person amount / percentage / shares field. */
  fieldWidth: 120,
  /** The square behind an expense's category icon. */
  iconBox: 40,
  /** Width of the currency / "%" / "×" suffix after a field. */
  suffixWidth: 16,
  /** Width of the language dropdown and its menu. */
  menuWidth: 160,
  /** The app column is centred on screens wider than this (web). */
  pageMaxWidth: 520,
  /** Space for the status bar / notch; no safe-area library is used. */
  statusBarInsetIos: 50,
  statusBarInsetAndroid: 24,
};
