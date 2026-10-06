import test from "node:test";
import assert from "node:assert/strict";
import { REDACTION_MARKERS, redact } from "../redaction.js";

const secret = "dummy-secret-7f9a";

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

test("redacts nested and array credential keys without changing safe structure", () => {
  const input = {
    user: "demo",
    password: secret,
    nested: [{ apiKey: "dummy-api-key", safe: "kept" }, { Authorization: "Bearer dummy-bearer" }]
  };
  const output = redact(input);
  assert.equal((output as { user: string }).user, "demo");
  assert.equal(serialized(output).includes(secret), false);
  assert.equal(serialized(output).includes("dummy-api-key"), false);
  assert.equal(serialized(output).includes("dummy-bearer"), false);
  assert.deepEqual(input, { user: "demo", password: secret, nested: [{ apiKey: "dummy-api-key", safe: "kept" }, { Authorization: "Bearer dummy-bearer" }] });
});

test("handles case and separator conventions for sensitive keys", () => {
  const output = redact({ PASSWORD: secret, "x-api-key": "dummy-x-key", refresh_token: "dummy-refresh" });
  assert.equal(serialized(output).includes(secret), false);
  assert.equal(serialized(output).includes("dummy-x-key"), false);
  assert.equal(serialized(output).includes("dummy-refresh"), false);
});

test("redacts repeated explicit secret values and error text", () => {
  const input = new Error(`failed with ${secret}; retry ${secret}`);
  const output = redact({ error: input, note: `${secret}/${secret}` }, { secrets: [secret] });
  assert.equal(serialized(output).includes(secret), false);
  assert.equal(serialized(output).includes(REDACTION_MARKERS.value), true);
});

test("redacts Mongo credential substrings and authorization values without claiming universal masking", () => {
  const output = redact({
    uri: "mongodb://dummyUser:dummyPassword@db.example.test/ledger",
    srv: "mongodb+srv://dummyUser:dummyPassword@cluster.example.test/ledger",
    text: "Authorization: Bearer dummy-header-token"
  });
  const text = serialized(output);
  assert.equal(text.includes("dummyUser"), false);
  assert.equal(text.includes("dummyPassword"), false);
  assert.equal(text.includes("dummy-header-token"), false);
});

test("bounds cycles, depth, and size with explicit markers", () => {
  const circular: { name: string; self?: unknown } = { name: "root" };
  circular.self = circular;
  assert.equal(serialized(redact(circular)).includes(REDACTION_MARKERS.cycle), true);
  assert.equal(serialized(redact({ deep: { deeper: { value: secret } } }, { maxDepth: 1 })).includes(secret), false);
  assert.equal(serialized(redact({ a: 1, b: 2, c: 3 }, { maxEntries: 1 })).includes(REDACTION_MARKERS.limit), true);
});

test("handles unsupported values and remains idempotent", () => {
  const input = { date: new Date("2020-01-01T00:00:00.000Z"), fn: () => secret, bigint: 3n, safe: "value" };
  const output = redact(input);
  assert.equal(serialized(output).includes(secret), false);
  assert.deepEqual(redact(output), output);
  assert.deepEqual(input.safe, "value");
  assert.equal((output as { date: string }).date, REDACTION_MARKERS.unsupported);
});
