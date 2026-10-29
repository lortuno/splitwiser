import { describe, expect, test } from "bun:test";

import { dateRange, newExpenseDate } from "../../../packages/app/src/trips/dates";

describe("dateRange", () => {
  test("shows both dates of a group", () => {
    expect(dateRange({ start_date: "2026-06-01", end_date: "2026-06-07" })).toBe("1 Jun 2026 – 7 Jun 2026");
  });

  test("is null for a group without dates, so the card and the header leave the date line out", () => {
    expect(dateRange({ start_date: null, end_date: null })).toBeNull();
  });
});

describe("newExpenseDate", () => {
  const group = { start_date: "2026-07-10", end_date: "2026-07-17" };

  test("today inside the group's dates, otherwise the nearest day of the group", () => {
    expect(newExpenseDate("2026-07-12", group)).toBe("2026-07-12");
    expect(newExpenseDate("2026-01-01", group)).toBe("2026-07-10");
    expect(newExpenseDate("2026-12-31", group)).toBe("2026-07-17");
  });

  test("today in a group without dates", () => {
    expect(newExpenseDate("2026-10-29", { start_date: null, end_date: null })).toBe("2026-10-29");
  });
});
