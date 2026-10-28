import { describe, expect, test } from "bun:test";

import {
  formatBasisPoints,
  formatBasisPointsInput,
  formatCents,
  formatCentsCompact,
  formatCentsInput,
  formatSignedCents,
} from "../../../packages/app/src/money/format";
import { parseEuroToCents, parsePercentToBasisPoints } from "../../../packages/app/src/money/parse";

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

describe("formatCentsCompact (hero total)", () => {
  test.each([
    [0, `0,00${NBSP}€`],
    [191557, `1.915,57${NBSP}€`],
    [99999999, `999.999,99${NBSP}€`],
    [100000000, `1${NBSP}M${NBSP}€`],
    [100999999, `1${NBSP}M${NBSP}€`],
    [123456789, `1,23${NBSP}M${NBSP}€`],
    [234567891, `2,34${NBSP}M${NBSP}€`],
    [2000000000, `20${NBSP}M${NBSP}€`],
    [125000000000, `1.250${NBSP}M${NBSP}€`],
  ])("%p cents -> %p", (cents, text) => {
    expect(formatCentsCompact(cents)).toBe(text);
  });

  test("cuts off instead of rounding up", () => {
    expect(formatCentsCompact(199999999)).toBe(`1,99${NBSP}M${NBSP}€`);
  });
});

describe("input strings for the edit form", () => {
  test.each([
    [3150, "31,50"],
    [100000000, "1000000,00"],
    [5, "0,05"],
    [1500, "15,00"],
  ])("%p cents -> %p, and back", (cents, text) => {
    expect(formatCentsInput(cents)).toBe(text);
    expect(parseEuroToCents(text)).toBe(cents);
  });

  test.each([
    [3333, "33,33"],
    [7000, "70,00"],
    [10000, "100,00"],
  ])("%p basis points -> %p, and back", (basisPoints, text) => {
    expect(formatBasisPointsInput(basisPoints)).toBe(text);
    expect(parsePercentToBasisPoints(text)).toBe(basisPoints);
  });
});
