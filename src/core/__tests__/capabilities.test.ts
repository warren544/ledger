import test from "node:test";
import assert from "node:assert/strict";
import { createCapabilityGate } from "../capabilities.js";

test("allows only explicit neutral capabilities", () => {
  const gate = createCapabilityGate(["sample.read", "sample.write"]);
  assert.deepEqual(gate.decide("sample.read"), { allowed: true, capability: "sample.read", reason: "allowlisted" });
  assert.deepEqual(gate.decide("sample.write"), { allowed: true, capability: "sample.write", reason: "allowlisted" });
});

test("denies empty, unknown, malformed, wrong-case, and whitespace-altered names", () => {
  const gate = createCapabilityGate(["sample.read"]);
  for (const candidate of [undefined, null, "", "sample.write", "SAMPLE.READ", " sample.read", "sample.read ", "sample", "sample.", ".read", "sample/read"]) {
    const decision = gate.decide(candidate);
    assert.equal(decision.allowed, false);
  }
  assert.equal(gate.decide("sample.write").reason, "not-allowlisted");
  assert.equal(gate.decide("SAMPLE.READ").reason, "invalid-name");
});

test("copies the trusted allowlist so caller mutation cannot widen access", () => {
  const allowlist = ["sample.read"];
  const gate = createCapabilityGate(allowlist);
  allowlist.push("sample.write");
  assert.equal(gate.decide("sample.write").allowed, false);
});

test("rejects malformed trusted construction input and keeps empty gates default-deny", () => {
  assert.throws(() => createCapabilityGate(["sample.read", " sample.write"]), /malformed/);
  const gate = createCapabilityGate([]);
  assert.equal(gate.decide("sample.read").allowed, false);
  assert.equal(gate.decide("sample.write").allowed, false);
});

test("independent gate instances do not share permissions", () => {
  const readGate = createCapabilityGate(["sample.read"]);
  const writeGate = createCapabilityGate(["sample.write"]);
  assert.equal(readGate.decide("sample.read").allowed, true);
  assert.equal(readGate.decide("sample.write").allowed, false);
  assert.equal(writeGate.decide("sample.write").allowed, true);
  assert.equal(writeGate.decide("sample.read").allowed, false);
});

test("serialized or untrusted data has no authority to widen a gate", () => {
  const gate = createCapabilityGate(["sample.read"]);
  const untrusted = JSON.parse('{"allowlist":["sample.read","sample.write"],"capability":"sample.write"}') as { allowlist: string[]; capability: string };
  untrusted.allowlist.push("sample.write");
  assert.equal(gate.decide(untrusted).allowed, false);
  assert.equal(Object.hasOwn(gate, "grant"), false);
  assert.equal(Object.hasOwn(gate, "update"), false);
});
