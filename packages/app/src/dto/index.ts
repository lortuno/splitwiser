// Mirrors the JSON returned by packages/api (src/Dto). All money fields are integer cents.

export type SplitType = "equal" | "exact" | "percentage" | "shares";

/** What an expense was for; the order is the form's order (see expenses/categories.ts for the icons). */
export type Category =
  | "food"
  | "groceries"
  | "drinks"
  | "coffee"
  | "fuel"
  | "transport"
  | "flights"
  | "lodging"
  | "activities"
  | "shopping"
  | "other";

export interface Person {
  id: number;
  name: string;
}

export interface User {
  id: number;
  /** The only name the app shows for an account; editable on "Settings". */
  display_name: string;
  email: string;
  /** The app language the person chose; the app starts in it. */
  language: "en" | "es" | "fr";
}

/** Response of POST /auth/signup and POST /auth/login. */
export interface AuthResult {
  token: string;
  user: User;
}

export interface Trip {
  id: number;
  name: string;
  /** Both null for a group without dates. */
  start_date: string | null;
  end_date: string | null;
  total_cents: number;
  /** True once a member marked the trip as paid (until someone reopens it). */
  paid: boolean;
  members?: Person[];
}

/** One suggested transfer seen from the user's side: they pay `person`, or `person` pays them. */
export interface DebtTransfer {
  direction: "pay" | "receive";
  person: Person;
  amount_cents: number;
}

/** What the user owes and is owed on one open group. */
export interface GroupDebts {
  trip_id: number;
  owe_cents: number;
  owed_cents: number;
  transfers: DebtTransfer[];
}

/** Response of GET /me/debts: totals over the user's open groups (never netted) and only groups with a transfer. */
export interface Debts {
  owe_cents: number;
  owed_cents: number;
  groups: GroupDebts[];
}

export interface Payer {
  person_id: number;
  name: string;
  amount_cents: number;
}

export interface SplitShare {
  person_id: number;
  name: string;
  /** Raw input: null (equal), cents (exact), basis points (percentage) or units (shares). */
  split_value: number | null;
  share_cents: number;
}

export interface Expense {
  id: number;
  trip_id: number;
  name: string;
  date: string;
  amount_cents: number;
  split_type: SplitType;
  category: Category;
  recorded_by: Person;
  paid_by: Payer[];
  split_between: SplitShare[];
  /** True once the expense was changed after it was saved. */
  edited: boolean;
}

export interface Balance {
  person_id: number;
  name: string;
  paid_cents: number;
  share_cents: number;
  net_cents: number;
}

export interface Transfer {
  from: Person;
  to: Person;
  amount_cents: number;
}

/** Who marked a trip as paid (their name on the trip today) and when, as "YYYY-MM-DDTHH:MM:SSZ" (UTC). */
export interface TripPaid {
  by: Person;
  at: string;
}

export interface TripSummary {
  trip_id: number;
  /** Currency code from the API; the app formats cents with money/format.ts. */
  currency: string;
  total_cents: number;
  expense_count: number;
  balances: Balance[];
  transfers: Transfer[];
  /** null while the trip is open. A paid trip still carries its real balances and transfers. */
  paid: TripPaid | null;
}

export interface NewExpense {
  name: string;
  date: string;
  amount_cents: number | null;
  paid_by: { person_id: number; amount_cents: number | null }[];
  split: { type: SplitType; between: { person_id: number; value: number | null }[] };
  /** Left out, the API guesses it for a new expense and keeps it for an edit. */
  category?: Category;
}

/** Response of GET /trips/{id}/category-suggestion. */
export interface CategorySuggestion {
  category: Category;
  source: "trip" | "keywords" | "none";
}

/** Body of POST /trips. The creator is never sent: the API adds them as the first member. */
export interface NewTrip {
  name: string;
  start_date: string | null;
  end_date: string | null;
  people: { name: string; email: string | null }[];
}

/** Response of POST /trips. */
export interface CreatedTrip {
  trip: Trip;
  summary: TripSummary;
}

export interface FieldError {
  code: string;
  /** English, for logs and tools: the app words errors itself from code and params (i18n/errors.ts). */
  message: string;
  /** The numbers in the error, e.g. { max: 60 } or { sum_cents: 4500, amount_cents: 5000 }. */
  params?: Record<string, number>;
}

/**
 * Expense keys: name, date, amount_cents, paid_by, paid_by.<id>, split, split.<id>, category. Sign-up keys: display_name, email,
 * password, language. New trip keys: name, start_date, end_date, people, people.<index>.name, people.<index>.email.
 */
export type FieldErrors = Record<string, FieldError>;
