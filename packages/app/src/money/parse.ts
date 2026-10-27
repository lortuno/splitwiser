// Parses user input into integers without ever going through floating point.
// Accepts "12", "12,5", "12,50", "12.50" (and an optional "€"); rejects thousands separators,
// more than two decimals, negatives and anything else by returning null.

const DECIMAL = /^(\d{1,9})(?:[.,](\d{1,2}))?$/;

function parseHundredths(input: string): number | null {
  const match = DECIMAL.exec(input.replace(/€|%|\s/g, ""));
  if (!match) {
    return null;
  }
  const whole = Number.parseInt(match[1], 10);
  const fraction = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10);
  return whole * 100 + fraction;
}

/** "12,50" | "12.50" -> 1250 cents. */
export function parseEuroToCents(input: string): number | null {
  return parseHundredths(input);
}

/** "33,33" -> 3333 basis points; must be at most 100 %. */
export function parsePercentToBasisPoints(input: string): number | null {
  const value = parseHundredths(input);
  return value !== null && value <= 10_000 ? value : null;
}

/** "3" -> 3; whole positive numbers only. */
export function parseWholeNumber(input: string): number | null {
  const trimmed = input.trim();
  return /^\d{1,6}$/.test(trimmed) ? Number.parseInt(trimmed, 10) : null;
}
