import { describe, expect, test } from "bun:test";

import { newTripBody, todayIso } from "../../../packages/app/src/trips/newTripInput";

describe("newTripBody", () => {
  test("trims every field and keeps the people in form order", () => {
    const body = newTripBody({
      name: "  Summer in Sicily ",
      startDate: " 2026-07-10",
      endDate: "2026-07-17 ",
      people: [
        { name: " Ben ", email: "  BEN@Example.com " },
        { name: "Grandma", email: "" },
      ],
    });

    expect(body).toEqual({
      name: "Summer in Sicily",
      start_date: "2026-07-10",
      end_date: "2026-07-17",
      people: [
        { name: "Ben", email: "BEN@Example.com" },
        { name: "Grandma", email: null },
      ],
    });
  });

  test("an email of only spaces is no email; the API lowercases emails itself", () => {
    expect(newTripBody({ name: "x", startDate: "", endDate: "", people: [{ name: "Ben", email: "   " }] }).people).toEqual([
      { name: "Ben", email: null },
    ]);
  });

  test("never adds the creator, and sends an empty list as it is (the API answers too_few)", () => {
    expect(newTripBody({ name: "Solo", startDate: "2026-07-10", endDate: "2026-07-10", people: [] }).people).toEqual([]);
  });

  test("empty and invalid input is passed on for the API to validate", () => {
    const body = newTripBody({ name: "", startDate: "10.07.2026", endDate: "", people: [{ name: "", email: "ben@x" }] });

    expect(body).toEqual({ name: "", start_date: "10.07.2026", end_date: "", people: [{ name: "", email: "ben@x" }] });
  });
});

describe("todayIso", () => {
  test("uses the local date with zero padding", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
    expect(todayIso(new Date(2026, 11, 31, 0, 1))).toBe("2026-12-31");
  });
});
