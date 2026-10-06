import test from "node:test";
import assert from "node:assert/strict";
import { appendHashChainEntry, HASH_CHAIN_GENESIS, verifyHashChain, type HashChain } from "../hash-chain.js";

test("returns the documented valid empty-chain result", () => {
  assert.deepEqual(verifyHashChain([]), { valid: true, head: HASH_CHAIN_GENESIS, count: 0 });
  assert.deepEqual(verifyHashChain([], { expectedHead: HASH_CHAIN_GENESIS, expectedCount: 0 }), { valid: true, head: HASH_CHAIN_GENESIS, count: 0 });
});

test("matches a stable known vector and canonicalizes object key order", () => {
  const first = appendHashChainEntry([], { event: "created", amount: 125 });
  assert.equal(first[0].hash, "d85c7c518117994d3e8df369b38116fafb237dce0968b472e0ba1f1badfa8011");
  const reordered = appendHashChainEntry([], { amount: 125, event: "created" });
  assert.equal(reordered[0].hash, first[0].hash);
});

test("appends multi-entry chains immutably and verifies the head and count", () => {
  const empty: HashChain = [];
  const one = appendHashChainEntry(empty, { step: 1 });
  const two = appendHashChainEntry(one, { step: 2 });
  assert.deepEqual(empty, []);
  assert.equal(one.length, 1);
  assert.equal(two.length, 2);
  assert.deepEqual(verifyHashChain(two, { expectedHead: two[1].hash, expectedCount: 2 }), { valid: true, head: two[1].hash, count: 2 });
});

test("rejects payload, hash, link, ordering, and deletion tampering", () => {
  const chain = appendHashChainEntry(appendHashChainEntry([], { step: 1 }), { step: 2 });
  const payloadTampered = [{ ...chain[0], payload: { step: 99 } }, chain[1]];
  assert.equal(verifyHashChain(payloadTampered).valid, false);
  const hashTampered = [{ ...chain[0], hash: "f".repeat(64) }, chain[1]];
  assert.equal(verifyHashChain(hashTampered).valid, false);
  const linkTampered = [chain[0], { ...chain[1], previousHash: "e".repeat(64) }];
  assert.equal(verifyHashChain(linkTampered).valid, false);
  assert.equal(verifyHashChain([chain[1], chain[0]]).valid, false);
  assert.equal(verifyHashChain(chain.slice(0, 1), { expectedCount: 2 }).valid, false);
});

test("rejects malformed entries and unsupported payload values without exposing payloads", () => {
  const malformed = [null, { version: 1 }, { version: 1, index: 0, previousHash: HASH_CHAIN_GENESIS, payload: { secret: "do-not-return" }, hash: "bad" }];
  for (const input of malformed) {
    const result = verifyHashChain([input]);
    assert.equal(result.valid, false);
    if (!result.valid) assert.equal(result.reason.includes("do-not-return"), false);
  }
  assert.throws(() => appendHashChainEntry([], { value: Number.NaN }), /non-finite/);
  assert.throws(() => appendHashChainEntry([], { value: new Date() }), /unsupported/);
  assert.throws(() => appendHashChainEntry([], { value: undefined }), /unsupported/);
  assert.throws(() => appendHashChainEntry([], [,,]), /sparse/);
});

test("rejects wrong trusted head and count while documenting truncation limits", () => {
  const chain = appendHashChainEntry([], { step: 1 });
  const wrongHead = verifyHashChain(chain, { expectedHead: "f".repeat(64) });
  const wrongCount = verifyHashChain(chain, { expectedCount: 2 });
  assert.equal(wrongHead.valid, false);
  assert.equal(wrongCount.valid, false);
  assert.equal(verifyHashChain(chain.slice(0, 1)).valid, true);
  assert.equal(verifyHashChain(chain.slice(0, 1), { expectedHead: chain[0].hash, expectedCount: 1 }).valid, true);
});
