import test from "node:test";
import assert from "node:assert/strict";
import { chainBadgeState, classifyApiState } from "../src/app/(ui)/_lib/ui-state.js";

test("UI state mapper distinguishes loading, empty, denied, validation and network states", () => {
  assert.equal(classifyApiState({ loading: true }), "loading");
  assert.equal(classifyApiState({ loading: false, status: 200, itemCount: 0 }), "empty");
  assert.equal(classifyApiState({ loading: false, status: 403 }), "denied");
  assert.equal(classifyApiState({ loading: false, status: 200, validationError: true }), "validation-error");
  assert.equal(classifyApiState({ loading: false, status: 503 }), "network-error");
});

test("chain badge never treats unknown or failed verification as verified", () => {
  assert.equal(chainBadgeState({ loaded: false, requestFailed: false }), "unknown");
  assert.equal(chainBadgeState({ loaded: true, requestFailed: true, valid: true }), "unavailable");
  assert.equal(chainBadgeState({ loaded: true, requestFailed: false, valid: false }), "invalid");
  assert.equal(chainBadgeState({ loaded: true, requestFailed: false, valid: true }), "verified");
});
