// Money is always integer cents. Display rule: "," as decimal separator, exactly two decimals,
// "." between thousands, a non-breaking space before the symbol: 123456 -> "1.234,56 €".

const NBSP = " ";

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
  return `${formatHundredths(cents)}${NBSP}€`;
}

/** Like formatCents but with an explicit "+" for positive amounts (used for balances). */
export function formatSignedCents(cents: number): string {
  return cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);
}

/** 3333 basis points -> "33,33 %". */
export function formatBasisPoints(basisPoints: number): string {
  return `${formatHundredths(basisPoints)}${NBSP}%`;
}
