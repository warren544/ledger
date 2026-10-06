import test from "node:test";
import assert from "node:assert/strict";
import { createIdGenerator, isUuid, parseUuid } from "../ids.js";

test("validates UUID strings and rejects malformed IDs", () => {
  const value = "550e8400-e29b-41d4-a716-446655440000";
  assert.equal(isUuid(value), true);
  assert.equal(parseUuid(value), value);
  assert.equal(isUuid("rec-invoice-a"), false);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.throws(() => parseUuid("rec-invoice-a"), /invalid UUID/);
});

test("uses an injected ID source and validates its output", () => {
  const generator = createIdGenerator(() => "550e8400-e29b-41d4-a716-446655440000");
  assert.equal(generator(), "550e8400-e29b-41d4-a716-446655440000");
  const invalid = createIdGenerator(() => "rec-invoice-a");
  assert.throws(() => invalid(), /invalid UUID/);
});
