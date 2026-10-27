import { describe, expect, test } from "bun:test";

import { formatBasisPoints, formatCents, formatSignedCents } from "../../../packages/app/src/money/format";

const NBSP = " ";

describe("formatCents", () => {
  test.each([
    [1250, "12,50"],
    [5, "0,05"],
    [0, "0,00"],
    [100, "1,00"],
    [99, "0,99"],
    [123456, "1.234,56"],
    [100000000, "1.000.000,00"],
    [-305, "-3,05"],
  ])("%p cents -> %p €", (cents, text) => {
    expect(formatCents(cents)).toBe(`${text}${NBSP}€`);
  });

  test("always uses a comma and exactly two decimals", () => {
    for (const cents of [1, 10, 101, 1999, 4321987]) {
      expect(formatCents(cents)).toMatch(/^[\d.]+,\d{2} €$/);
    }
  });

  test("rejects non-integers", () => {
    expect(() => formatCents(12.5)).toThrow(RangeError);
  });
});

describe("other formats", () => {
  test("signed balances", () => {
    expect(formatSignedCents(2340)).toBe(`+23,40${NBSP}€`);
    expect(formatSignedCents(-2340)).toBe(`-23,40${NBSP}€`);
    expect(formatSignedCents(0)).toBe(`0,00${NBSP}€`);
  });

  test("percentages from basis points", () => {
    expect(formatBasisPoints(3333)).toBe(`33,33${NBSP}%`);
    expect(formatBasisPoints(10000)).toBe(`100,00${NBSP}%`);
  });
});
