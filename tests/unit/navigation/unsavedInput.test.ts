import { describe, expect, test } from "bun:test";

import { emptyForm } from "../../../packages/app/src/expenses/expenseForm";
import { hasUnsavedInput, sameInput, setUnsavedInput } from "../../../packages/app/src/navigation/unsavedInput";

// "Discard your changes?" asks only when a form's input differs from how it opened (epic 6, checks 21 and 22).
const members = [
  { id: 1, name: "Ana" },
  { id: 2, name: "Ben" },
];
const { categoryPicked: _picked, ...expense } = emptyForm(members as never, "2026-10-28");
const trip = { name: "", startDate: "2026-10-28", endDate: "2026-10-28", people: [{ name: "", email: "" }] };

describe("unsaved input", () => {
  test.each([
    ["expense form", expense],
    ["new trip", trip],
    ["settings name", "Noah"],
  ])("%s: untouched is unchanged", (_, opened) => {
    expect(sameInput(opened, structuredClone(opened))).toBe(true);
  });

  test.each([
    ["expense name", expense, { ...expense, name: "Taxi" }],
    ["expense amount", expense, { ...expense, amountText: "10,00" }],
    ["expense payer", expense, { ...expense, payers: [1] }],
    ["expense split", expense, { ...expense, splitType: "shares" }],
    ["trip name", trip, { ...trip, name: "Rome" }],
    ["trip person", trip, { ...trip, people: [{ name: "Ana", email: "" }] }],
    ["trip extra card", trip, { ...trip, people: [...trip.people, { name: "", email: "" }] }],
    ["settings name", "Noah", "Noah B"],
  ])("%s: changed", (_, opened, current) => {
    expect(sameInput(opened, current)).toBe(false);
  });

  test.each([
    ["expense name typed and cleared", expense, { ...expense, name: "" }],
    ["a payer unticked and ticked again", { ...expense, between: [1, 2] }, { ...expense, between: [2, 1] }],
    ["a payer amount typed and cleared", expense, { ...expense, payerAmounts: { 1: "" } }],
    ["settings name changed back", "Noah", "Noah"],
  ])("%s: changed back counts as unchanged", (_, opened, current) => {
    expect(sameInput(opened, current)).toBe(true);
  });

  test("the app menu reads what the open form reported", () => {
    setUnsavedInput(true);
    expect(hasUnsavedInput()).toBe(true);
    setUnsavedInput(false);
    expect(hasUnsavedInput()).toBe(false);
  });
});
