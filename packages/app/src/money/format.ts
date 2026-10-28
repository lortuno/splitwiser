// Money is always integer cents. Display rule: "," as decimal separator, exactly two decimals,
// "." between thousands, a non-breaking space before the currency symbol: 123456 -> "1.234,56 €".

const NBSP = "\u00A0";

/** The only place the app names the currency: euros are the only currency. */
export const CURRENCY_SYMBOL = "€";

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Formats a two-decimal fixed-point integer (cents or basis points) as "1.234,56". */
function formatHundredths(value: number): string {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Expected an integer, got ${value}`);
  }
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, "0");
  return `${sign}${groupThousands(String(whole))},${fraction}`;
}

export function formatCents(cents: number): string {
  return `${formatHundredths(cents)}${NBSP}${CURRENCY_SYMBOL}`;
}

const CENTS_PER_MILLION = 100_000_000;
const CENTS_PER_HUNDREDTH_MILLION = CENTS_PER_MILLION / 100;

/**
 * Like formatCents, but from 1.000.000,00 € up in millions with two decimals, cut off (never rounded up)
 * and without a trailing ",00": 234567891 -> "2,34 M €", 100000000 -> "1 M €". Used for the hero total only.
 */
export function formatCentsCompact(cents: number): string {
  if (Math.abs(cents) < CENTS_PER_MILLION) {
    return formatCents(cents);
  }
  const hundredths = Math.trunc(cents / CENTS_PER_HUNDREDTH_MILLION);
  const millions = formatHundredths(hundredths).replace(/,00$/, "");
  return `${millions}${NBSP}M${NBSP}${CURRENCY_SYMBOL}`;
}

/** Like formatCents but with an explicit "+" for positive amounts (used for balances). */
export function formatSignedCents(cents: number): string {
  return cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);
}

/**
 * Cents as a form would take them: no thousands separators, no symbol. 3150 -> "31,50", 100000000 -> "1000000,00".
 * Reads back with parseEuroToCents.
 */
export function formatCentsInput(cents: number): string {
  return formatHundredths(cents).split(".").join("");
}

/** Basis points as a form would take them: 3333 -> "33,33". Reads back with parsePercentToBasisPoints. */
export function formatBasisPointsInput(basisPoints: number): string {
  return formatCentsInput(basisPoints);
}

/** 3333 basis points -> "33,33 %". */
export function formatBasisPoints(basisPoints: number): string {
  return `${formatHundredths(basisPoints)}${NBSP}%`;
}
