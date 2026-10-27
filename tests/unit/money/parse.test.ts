import { describe, expect, test } from "bun:test";

import { formatCents } from "../../../packages/app/src/money/format";
import { parseEuroToCents, parsePercentToBasisPoints, parseWholeNumber } from "../../../packages/app/src/money/parse";

describe("parseEuroToCents", () => {
  test.each([
    ["12,50", 1250],
    ["12.50", 1250],
    ["12", 1200],
    ["0,5", 50],
    ["0.05", 5],
    [" 7,99 € ", 799],
    ["0", 0],
    ["1234,56", 123456],
  ])("%p -> %p cents", (input, cents) => {
    expect(parseEuroToCents(input)).toBe(cents);
  });

  test.each(["", "abc", "12,505", "1.234,50", "-3", "12,", ",50", "1e3", "12,5a"])("rejects %p", (input) => {
    expect(parseEuroToCents(input)).toBeNull();
  });

  test("avoids floating point errors", () => {
    expect(parseEuroToCents("0,29")).toBe(29);
    expect(parseEuroToCents("1,15")).toBe(115);
    expect(parseEuroToCents("4,35")).toBe(435);
  });

  test("round-trips with formatCents", () => {
    for (const cents of [1, 99, 1250, 99999]) {
      expect(parseEuroToCents(formatCents(cents))).toBe(cents);
    }
  });
});

describe("parsePercentToBasisPoints", () => {
  test("parses percentages with up to two decimals", () => {
    expect(parsePercentToBasisPoints("33,33")).toBe(3333);
    expect(parsePercentToBasisPoints("25")).toBe(2500);
    expect(parsePercentToBasisPoints("100")).toBe(10000);
  });

  test("rejects more than 100 % or bad input", () => {
    expect(parsePercentToBasisPoints("100,01")).toBeNull();
    expect(parsePercentToBasisPoints("33,333")).toBeNull();
  });
});

describe("parseWholeNumber", () => {
  test("parses whole numbers only", () => {
    expect(parseWholeNumber("3")).toBe(3);
    expect(parseWholeNumber("1,5")).toBeNull();
    expect(parseWholeNumber("")).toBeNull();
  });
});
