import { describe, expect, test } from "bun:test";

import type { Expense } from "../../../packages/app/src/dto";
import { CATEGORIES, categoryIcon, categoryLabel } from "../../../packages/app/src/expenses/categories";
import { applySuggestion, emptyForm, formFromExpense } from "../../../packages/app/src/expenses/expenseForm";

const ana = { id: 1, name: "Ana" };
const chloe = { id: 3, name: "Chloé" };

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: 21,
    trip_id: 7,
    name: "Tapas at Mercado de San Miguel",
    date: "2026-09-12",
    amount_cents: 4830,
    split_type: "equal",
    category: "food",
    recorded_by: chloe,
    paid_by: [{ person_id: 3, name: "Chloé", amount_cents: 4830 }],
    split_between: [
      { person_id: 1, name: "Ana", split_value: null, share_cents: 2415 },
      { person_id: 3, name: "Chloé", split_value: null, share_cents: 2415 },
    ],
    edited: false,
    ...overrides,
  };
}

describe("expense form prefill", () => {
  test("one payer, equal split", () => {
    expect(formFromExpense(expense({}))).toEqual({
      name: "Tapas at Mercado de San Miguel",
      date: "2026-09-12",
      amountText: "48,30",
      payers: [3],
      payerAmounts: { 3: "48,30" },
      splitType: "equal",
      between: [1, 3],
      splitValues: {},
      category: "food",
      categoryPicked: true,
    });
  });

  test("several payers keep their own amounts", () => {
    const form = formFromExpense(
      expense({
        amount_cents: 3150,
        paid_by: [
          { person_id: 1, name: "Ana", amount_cents: 1250 },
          { person_id: 3, name: "Chloé", amount_cents: 1900 },
        ],
      }),
    );
    expect(form.payers).toEqual([1, 3]);
    expect(form.payerAmounts).toEqual({ 1: "12,50", 3: "19,00" });
    expect(form.amountText).toBe("31,50");
  });

  test("exact amounts, percentages and shares are shown as typed", () => {
    const between = (a: number, c: number) => [
      { person_id: 1, name: "Ana", split_value: a, share_cents: 0 },
      { person_id: 3, name: "Chloé", split_value: c, share_cents: 0 },
    ];
    const exact = formFromExpense(expense({ split_type: "exact", split_between: between(1500, 3330) }));
    const percent = formFromExpense(expense({ split_type: "percentage", split_between: between(3333, 6667) }));
    const shares = formFromExpense(expense({ split_type: "shares", split_between: between(2, 1) }));

    expect([exact.splitType, exact.splitValues]).toEqual(["exact", { 1: "15,00", 3: "33,30" }]);
    expect([percent.splitType, percent.splitValues]).toEqual(["percentage", { 1: "33,33", 3: "66,67" }]);
    expect([shares.splitType, shares.splitValues]).toEqual(["shares", { 1: "2", 3: "1" }]);
  });

  test("the very large amount has no thousands separators", () => {
    expect(formFromExpense(expense({ amount_cents: 100_000_000 })).amountText).toBe("1000000,00");
  });

  test("a new expense starts empty, split equally between everyone", () => {
    expect(emptyForm([ana, chloe], "2026-09-13")).toEqual({
      name: "",
      date: "2026-09-13",
      amountText: "",
      payers: [],
      payerAmounts: {},
      splitType: "equal",
      between: [1, 3],
      splitValues: {},
      category: "other",
      categoryPicked: false,
    });
  });
});

describe("category suggestion", () => {
  test("a suggestion replaces the category while none was picked", () => {
    expect(applySuggestion("other", false, "Gasolne Repsol", "fuel")).toBe("fuel");
    expect(applySuggestion("fuel", false, "Dinner", "food")).toBe("food");
  });

  test("a picked category never changes, also not for an empty name", () => {
    expect(applySuggestion("drinks", true, "Dinner and wine", "food")).toBe("drinks");
    expect(applySuggestion("drinks", true, "", null)).toBe("drinks");
  });

  test("an empty name goes back to other until something is picked", () => {
    expect(applySuggestion("fuel", false, "  ", null)).toBe("other");
  });

  test("the edit form starts from the stored category, picked", () => {
    const form = formFromExpense(expense({ category: "activities" }));
    expect([form.category, form.categoryPicked]).toEqual(["activities", true]);
  });

  test("every category has an icon and a label, in the form's order", () => {
    expect(CATEGORIES.map((c) => c.code)).toEqual([
      "food", "groceries", "drinks", "coffee", "fuel", "transport", "flights", "lodging", "activities", "shopping", "other",
    ]);
    expect(CATEGORIES.map((c) => `${categoryIcon(c.code)} ${categoryLabel(c.code)}`)).toEqual([
      "🍴 Food", "🛒 Groceries", "🍺 Drinks", "☕ Coffee", "⛽ Fuel", "🚕 Transport", "✈️ Flights", "🏨 Lodging",
      "🎟️ Activities", "🛍️ Shopping", "🧾 Other",
    ]);
  });
});
