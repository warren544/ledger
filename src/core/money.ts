/**
 * USD money represented as an exact, safe integer number of cents.
 * Currency is fixed to USD and signs are permitted; no rates or billing
 * semantics belong in this utility.
 */
export type MoneyCents = number & { readonly __brand: "MoneyCents" };

const MAX_SAFE_CENTS = Number.MAX_SAFE_INTEGER;

function checkedCents(value: number): MoneyCents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError("money cents must be a safe integer");
  }
  return value as MoneyCents;
}

/** Validate and brand an exact USD-cent amount. */
export function cents(value: number): MoneyCents {
  return checkedCents(value);
}

/** Add two USD-cent amounts, rejecting safe-integer overflow. */
export function addCents(left: MoneyCents, right: MoneyCents): MoneyCents {
  const a = checkedCents(left);
  const b = checkedCents(right);
  const result = a + b;
  if (!Number.isSafeInteger(result) || Math.abs(result) > MAX_SAFE_CENTS) {
    throw new RangeError("money addition overflow");
  }
  return result as MoneyCents;
}

/** Subtract two USD-cent amounts, rejecting safe-integer overflow. */
export function subtractCents(left: MoneyCents, right: MoneyCents): MoneyCents {
  const a = checkedCents(left);
  const b = checkedCents(right);
  const result = a - b;
  if (!Number.isSafeInteger(result) || Math.abs(result) > MAX_SAFE_CENTS) {
    throw new RangeError("money subtraction overflow");
  }
  return result as MoneyCents;
}

/**
 * Parse a decimal USD amount without floating-point arithmetic.
 *
 * The accepted form is an optional leading minus, optional `$`, digits, and
 * zero through two fractional digits. Whitespace, commas, signs other than
 * minus, exponents, and silent rounding are rejected.
 */
export function parseDecimalDollars(input: string): MoneyCents {
  if (!/^-?\$?(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(input)) {
    throw new RangeError("invalid USD decimal amount");
  }

  const negative = input.startsWith("-");
  const unsigned = negative ? input.slice(1) : input;
  const dollars = unsigned.startsWith("$") ? unsigned.slice(1) : unsigned;
  const [whole, fraction = ""] = dollars.split(".");
  const centsValue = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0") || "0");
  const signed = negative ? -centsValue : centsValue;
  if (signed > BigInt(MAX_SAFE_CENTS) || signed < BigInt(-MAX_SAFE_CENTS)) {
    throw new RangeError("money amount exceeds safe integer range");
  }
  return checkedCents(Number(signed));
}

/** Format safe USD cents as a sign-preserving, non-grouped dollar amount. */
export function formatUsd(value: MoneyCents): string {
  const amount = checkedCents(value);
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${negative ? "-" : ""}$${whole}.${fraction}`;
}
