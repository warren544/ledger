import test from "node:test";
import assert from "node:assert/strict";
import { parseUuid } from "../../ids.js";
import { computeVariance, sumCents } from "../variance.js";
import { matchRecords } from "../match.js";
import { exceptionSchema, transitionException } from "../exception.js";
import { reconAuditEventSchema, reconRecordSchema, type ReconRecord } from "../index.js";

const ids = ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002", "550e8400-e29b-41d4-a716-446655440003"];
const base = (recordId: string, workspaceId = "demo"): ReconRecord => reconRecordSchema.parse({ recordId, workspaceId, schemaVersion: 1, sourceSystem: "synthetic", recordedAt: "2026-10-11T09:00:00.000Z", contentHash: "a".repeat(64) });

test("strict recon records reject unknown fields and invalid money", () => {
  assert.equal(reconRecordSchema.parse(base(ids[0])).recordId, parseUuid(ids[0]));
  assert.throws(() => reconRecordSchema.parse({ ...base(ids[0]), labels: ["hidden"] }), /Unrecognized key/);
  assert.throws(() => reconRecordSchema.parse({ ...base(ids[0]), recordId: "not-an-id" }), /UUID/);
});

test("matching groups by workspace and key with deterministic case IDs", () => {
  const records = [base(ids[0]), base(ids[1]), base(ids[2], "other")];
  const options = { pack: "transport" as const, keyFor: (record: typeof records[number]) => record.recordId === ids[2] ? "b" : "a" };
  const first = matchRecords(records, options);
  const second = matchRecords(records, options);
  assert.deepEqual(first, second);
  assert.equal(first.length, 2);
  assert.equal(first[0].recordIds.length, 2);
  assert.equal(first[0].status, "open");
  assert.notEqual(first[0].caseId, first[1].caseId);
});

test("variance is exact, signed, and tolerance-aware", () => {
  assert.deepEqual(computeVariance(1050 as never, 1000 as never, 50 as never), { leftCents: 1050, rightCents: 1000, varianceCents: 50, toleranceCents: 50, sign: "positive", withinTolerance: true });
  assert.equal(computeVariance(-10 as never, 0 as never).sign, "negative");
  assert.equal(sumCents([1 as never, 2 as never, -1 as never]), 2);
  assert.throws(() => computeVariance(1 as never, 2 as never, -1 as never), /non-negative/);
});

test("exception transitions are constrained and auditable", () => {
  const exception = exceptionSchema.parse({ exceptionId: ids[0], workspaceId: "demo", caseId: ids[1], code: "SHORT_COUNT", severity: "high", state: "open", evidence: [], variance: null, createdAt: "2026-10-11T09:00:00.000Z", updatedAt: "2026-10-11T09:00:00.000Z" });
  const drafted = transitionException(exception, "drafted", "2026-10-11T09:01:00.000Z");
  assert.equal(drafted.state, "drafted");
  assert.throws(() => transitionException(drafted, "resolved", "2026-10-11T09:02:00.000Z"), /invalid exception transition/);
});

test("audit event schema is strict and versioned", () => {
  const event = reconAuditEventSchema.parse({ version: 1, index: 0, type: "exception.created", actorId: ids[0], subjectId: ids[1], workspaceId: "demo", createdAt: "2026-10-11T09:00:00.000Z", previousHash: "0".repeat(64), payloadHash: "a".repeat(64), hash: "b".repeat(64) });
  assert.equal(event.version, 1);
  assert.throws(() => reconAuditEventSchema.parse({ ...event, payload: "not-allowed" }), /Unrecognized key/);
});
