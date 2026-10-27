// Mirrors the JSON returned by packages/api (src/Dto). All money fields are integer cents.

export type SplitType = "equal" | "exact" | "percentage" | "shares";

export interface Person {
  id: number;
  name: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

/** Response of POST /auth/signup and POST /auth/login. */
export interface AuthResult {
  token: string;
  user: User;
}

export interface Trip {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  total_cents: number;
  members?: Person[];
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
  recorded_by: Person;
  paid_by: Payer[];
  split_between: SplitShare[];
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

export interface TripSummary {
  trip_id: number;
  /** Currency code from the API; the app formats cents with money/format.ts. */
  currency: string;
  total_cents: number;
  expense_count: number;
  balances: Balance[];
  transfers: Transfer[];
}

export interface NewExpense {
  name: string;
  date: string;
  amount_cents: number | null;
  paid_by: { person_id: number; amount_cents: number | null }[];
  split: { type: SplitType; between: { person_id: number; value: number | null }[] };
}

export interface FieldError {
  code: string;
  message: string;
}

/** Expense keys: name, date, amount_cents, paid_by, paid_by.<id>, split, split.<id>. Sign-up keys: name, email, password. */
export type FieldErrors = Record<string, FieldError>;
