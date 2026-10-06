import test from "node:test";
import assert from "node:assert/strict";
import { addCents, cents, formatUsd, parseDecimalDollars, subtractCents } from "../money.js";

test("validates safe integer cents and formats zero, negative, and positive values", () => {
  assert.equal(formatUsd(cents(0)), "$0.00");
  assert.equal(formatUsd(cents(12345)), "$123.45");
  assert.equal(formatUsd(cents(-12345)), "-$123.45");
  assert.throws(() => cents(Number.NaN), /safe integer/);
  assert.throws(() => cents(Number.POSITIVE_INFINITY), /safe integer/);
  assert.throws(() => cents(1.5), /safe integer/);
  assert.throws(() => cents(Number.MAX_SAFE_INTEGER + 1), /safe integer/);
});

test("parses exact decimal dollars without rounding or notation", () => {
  for (const [value, expected] of [["0", "$0.00"], ["0.5", "$0.50"], ["$0.50", "$0.50"], ["12.34", "$12.34"], ["-$12.34", "-$12.34"], ["-0.01", "-$0.01"]]) {
    assert.equal(formatUsd(parseDecimalDollars(value)), expected);
  }
  for (const value of ["1.234", "1e2", " 1.00", "1.00 ", "+1.00", "1,000.00", "", "$-1.00"]) {
    assert.throws(() => parseDecimalDollars(value), /invalid USD decimal/);
  }
});

test("rejects decimal overflow and checks arithmetic overflow", () => {
  assert.throws(() => parseDecimalDollars("90071992547409.92"), /safe integer range/);
  assert.equal(addCents(cents(100), cents(-25)), 75);
  assert.equal(subtractCents(cents(100), cents(125)), -25);
  assert.throws(() => addCents(cents(Number.MAX_SAFE_INTEGER), cents(1)), /addition overflow/);
  assert.throws(() => subtractCents(cents(-Number.MAX_SAFE_INTEGER), cents(1)), /subtraction overflow/);
});
