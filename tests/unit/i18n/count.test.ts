import { describe, expect, test } from "bun:test";

import { tCount } from "../../../packages/app/src/i18n";

describe("tCount", () => {
  test.each([
    [0, "0 expenses"],
    [1, "1 expense"],
    [20, "20 expenses"],
  ])("%p expenses -> %p", (count, text) => {
    expect(tCount("trip.expenseCount", count)).toBe(text);
  });

  test.each([
    [1, "1 person"],
    [4, "4 people"],
  ])("%p people -> %p", (count, text) => {
    expect(tCount("trip.peopleCount", count)).toBe(text);
  });
});
