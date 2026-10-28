// The add/edit expense form state as typed text, and how a saved expense fills it. Pure, so it is unit tested.
import type { Expense, Person, SplitType } from "../dto";
import { formatBasisPointsInput, formatCentsInput } from "../money/format";

export interface ExpenseFormState {
  name: string;
  date: string;
  amountText: string;
  payers: number[];
  /** Per payer, as typed; only shown with several payers. */
  payerAmounts: Record<number, string>;
  splitType: SplitType;
  between: number[];
  /** Per person in "Split between", as typed; empty for an equal split. */
  splitValues: Record<number, string>;
}

/** A new expense: today's date (or the nearest trip day), nobody paid yet, split equally between everyone. */
export function emptyForm(members: Person[], date: string): ExpenseFormState {
  return {
    name: "",
    date,
    amountText: "",
    payers: [],
    payerAmounts: {},
    splitType: "equal",
    between: members.map((m) => m.id),
    splitValues: {},
  };
}

/** Every field as the person would have typed it: "31,50" for cents, "33,33" for percent, "2" for shares. */
export function formFromExpense(expense: Expense): ExpenseFormState {
  return {
    name: expense.name,
    date: expense.date,
    amountText: formatCentsInput(expense.amount_cents),
    payers: expense.paid_by.map((p) => p.person_id),
    payerAmounts: Object.fromEntries(expense.paid_by.map((p) => [p.person_id, formatCentsInput(p.amount_cents)])),
    splitType: expense.split_type,
    between: expense.split_between.map((s) => s.person_id),
    splitValues: Object.fromEntries(
      expense.split_between
        .filter((s) => s.split_value !== null)
        .map((s) => [s.person_id, splitValueInput(expense.split_type, s.split_value as number)]),
    ),
  };
}

function splitValueInput(type: SplitType, value: number): string {
  switch (type) {
    case "exact":
      return formatCentsInput(value);
    case "percentage":
      return formatBasisPointsInput(value);
    default:
      return String(value);
  }
}
