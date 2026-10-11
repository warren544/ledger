import assert from "node:assert/strict";
import test from "node:test";
import { appendHashChainEntry, verifyHashChain } from "../../src/core/hash-chain.js";
import { DEMO_ACTORS, authorize, issueDemoSession, verifyDemoSession, type ReconActor } from "../../src/server/recon/auth.js";
import { createReconService } from "../../src/server/recon/service.js";
import type { ReconRepository, ReconEventInput, StoredReconEvent } from "../../src/server/recon/repository.js";
import type { ReconCase } from "../../src/core/recon/record-types.js";
import type { ReconException } from "../../src/core/recon/exception.js";
import type { StoredDraft } from "../../src/server/recon/drafter.js";
import type { ReconCorrection } from "../../src/server/recon/repository.js";
import type { ReconRule } from "../../src/core/recon/rules.js";
import { errorResponse, readJsonBody } from "../../src/app/api/_lib/recon.js";
import type { StructuredResponsesClient } from "../../src/adapters/llm/index.js";

const secret = "dummy-demo-session-secret";
const workspace = "synthetic_step3";
const otherWorkspace = "synthetic_other";
const ids = {
  manifest: "550e8400-e29b-41d4-a716-446655440301",
  customer: "550e8400-e29b-41d4-a716-446655440302",
  seal: "550e8400-e29b-41d4-a716-446655440303",
  count: "550e8400-e29b-41d4-a716-446655440304",
  receipt: "550e8400-e29b-41d4-a716-446655440305",
  credit: "550e8400-e29b-41d4-a716-446655440306"
} as const;
const timestamp = "2026-10-11T09:00:00.000Z";
const base = { workspaceId: workspace, schemaVersion: 1, sourceSystem: "synthetic-test", recordedAt: timestamp, contentHash: "a".repeat(64) };

function records(workspaceId = workspace, countCents = 1000) {
  return [
    { ...base, workspaceId, recordId: ids.manifest, recordType: "manifest", manifestId: ids.manifest, routeId: "route-1", stopId: "stop-1", customerId: ids.customer, declaredCents: 1000, bagCount: 1, scheduledAt: timestamp },
    { ...base, workspaceId, recordId: ids.seal, recordType: "bag_seal", sealId: ids.seal, bagId: "bag-1", manifestId: ids.manifest, stopId: "stop-1", sealStatus: "intact", scannedAt: timestamp },
    { ...base, workspaceId, recordId: ids.count, recordType: "truck_count", countId: ids.count, manifestId: ids.manifest, countedCents: countCents, countedBy: "synthetic-counter", countedAt: timestamp },
    { ...base, workspaceId, recordId: ids.receipt, recordType: "customer_receipt", receiptId: ids.receipt, stopId: "stop-1", signedCents: countCents, signedAt: timestamp, signerRole: "synthetic-signer" },
    { ...base, workspaceId, recordId: ids.credit, recordType: "bank_credit", creditId: ids.credit, manifestId: ids.manifest, creditedCents: countCents, valueDate: "2026-10-11", achTraceId: "trace-1" }
  ];
}

class MemoryRepository implements ReconRepository {
  readonly records = new Map<string, Record<string, unknown>>();
  readonly cases = new Map<string, ReconCase>();
  readonly exceptions = new Map<string, ReconException>();
  readonly drafts = new Map<string, StoredDraft>();
  readonly corrections: ReconCorrection[] = [];
  readonly rules = new Map<string, ReconRule>();
  readonly events: StoredReconEvent[] = [];
  async upsertRecord(record: Record<string, unknown>) { this.records.set(`${record.workspaceId}:${record.recordId}`, structuredClone(record)); }
  async upsertCase(value: ReconCase) { this.cases.set(`${value.workspaceId}:${value.caseId}`, structuredClone(value)); }
  async updateCase(value: ReconCase) { this.cases.set(`${value.workspaceId}:${value.caseId}`, structuredClone(value)); }
  async getCase(workspaceId: string, caseId: string) { return structuredClone(this.cases.get(`${workspaceId}:${caseId}`) ?? null); }
  async listCases(workspaceId: string, pack?: string, status?: string) { return [...this.cases.values()].filter((value) => value.workspaceId === workspaceId && (pack === undefined || value.pack === pack) && (status === undefined || value.status === status)); }
  async getRecords(workspaceId: string, recordIds: readonly string[]) { return recordIds.map((id) => this.records.get(`${workspaceId}:${id}`)).filter((value): value is Record<string, unknown> => value !== undefined).map((value) => { const { pack, key, createdAt, ...record } = structuredClone(value); return record; }); }
  async insertException(value: ReconException) { this.exceptions.set(`${value.workspaceId}:${value.exceptionId}`, structuredClone(value)); }
  async updateException(value: ReconException) { this.exceptions.set(`${value.workspaceId}:${value.exceptionId}`, structuredClone(value)); }
  async getException(workspaceId: string, exceptionId: string) { return structuredClone(this.exceptions.get(`${workspaceId}:${exceptionId}`) ?? null); }
  async listExceptions(workspaceId: string, caseId: string) { return [...this.exceptions.values()].filter((value) => value.workspaceId === workspaceId && value.caseId === caseId); }
  async saveDraft(workspaceId: string, exceptionId: string, draft: StoredDraft) { this.drafts.set(`${workspaceId}:${exceptionId}`, structuredClone(draft)); }
  async getDraft(workspaceId: string, exceptionId: string) { return structuredClone(this.drafts.get(`${workspaceId}:${exceptionId}`) ?? null); }
  async insertCorrection(value: ReconCorrection) { this.corrections.push(structuredClone(value)); }
  async getCorrection(_workspaceId: string, correctionId: string) { return structuredClone(this.corrections.find((value) => value.correctionId === correctionId) ?? null); }
  async insertRule(value: ReconRule) { this.rules.set(`${value.workspaceId}:${value.ruleId}:${value.version}`, structuredClone(value)); }
  async updateRule(value: ReconRule) { this.rules.set(`${value.workspaceId}:${value.ruleId}:${value.version}`, structuredClone(value)); }
  async getRule(workspaceId: string, ruleId: string, version?: number) { return structuredClone([...this.rules.values()].find((value) => value.workspaceId === workspaceId && value.ruleId === ruleId && (version === undefined || value.version === version)) ?? null); }
  async listRules(workspaceId: string) { return [...this.rules.values()].filter((value) => value.workspaceId === workspaceId); }
  async listEvents(workspaceId: string, subjectId?: string) { return this.events.filter((value) => value.workspaceId === workspaceId && (subjectId === undefined || value.subjectId === subjectId)); }
  async appendEvent(input: ReconEventInput) {
    const chain = this.events.filter((value) => value.workspaceId === input.workspaceId).sort((left, right) => left.chain.index - right.chain.index).map((value) => value.chain);
    const entry = appendHashChainEntry(chain, input.payload);
    const stored: StoredReconEvent = { schemaVersion: 1, workspaceId: input.workspaceId, eventId: `event-${entry[entry.length - 1].hash}`, actorId: input.actorId, subjectId: input.subjectId, type: input.type, createdAt: timestamp, chain: entry[entry.length - 1] };
    this.events.push(stored);
    return stored;
  }
  async verifyEvents(workspaceId: string) {
    const chain = this.events.filter((value) => value.workspaceId === workspaceId).sort((left, right) => left.chain.index - right.chain.index).map((value) => value.chain);
    const result = verifyHashChain(chain);
    return result.valid ? { valid: true, count: result.count, head: result.head, index: null } : { valid: false, count: chain.length, head: "", index: result.index, reason: result.reason };
  }
}

const actor = (role: "agent" | "demo_operator" | "human_approver", workspaceId = workspace): ReconActor => verifyDemoSession(issueDemoSession(role, workspaceId, secret, 1_000, 10_000), secret, 2_000);

test("signed demo sessions keep proposer/operator/approver identities distinct", () => {
  const agent = actor("agent");
  const operator = actor("demo_operator");
  const approver = actor("human_approver");
  assert.deepEqual([agent.actorId, operator.actorId, approver.actorId], [DEMO_ACTORS.agent, DEMO_ACTORS.demo_operator, DEMO_ACTORS.human_approver]);
  assert.notEqual(operator.actorId, approver.actorId);
  assert.equal(authorize(agent, "records.ingest").allowed, false);
  assert.equal(authorize(approver, "rule.approve").allowed, true);
  assert.equal(authorize(approver, "rules.approve" as never).allowed, false);
});

test("ingest, run, read, and audit verification are workspace-scoped and chained", async () => {
  const repository = new MemoryRepository();
  const service = createReconService(repository, () => timestamp);
  const result = await service.ingest(actor("demo_operator"), "transport", records());
  assert.equal(result.recordCount, 5);
  const run = await service.run(actor("agent"), result.caseIds[0]);
  assert.deepEqual(run, { caseId: result.caseIds[0], status: "clean", findingCount: 0 });
  const read = await service.get(actor("agent"), result.caseIds[0]);
  assert.equal(read.records.length, 5);
  assert.equal(read.timeline.length, 2);
  const verified = await service.verify(actor("human_approver"));
  assert.equal(verified.valid, true);
  assert.equal(verified.count, 2);
  assert.equal((await service.list(actor("agent"), "transport", "clean")).length, 1);
  assert.equal((await service.list(actor("agent", otherWorkspace))).length, 0);
});

test("run persists an exception and every mutation remains append-only", async () => {
  const repository = new MemoryRepository();
  const service = createReconService(repository, () => timestamp);
  const result = await service.ingest(actor("demo_operator"), "transport", records(workspace, 800));
  const run = await service.run(actor("agent"), result.caseIds[0]);
  assert.equal(run.status, "excepted");
  assert.equal((await service.get(actor("agent"), result.caseIds[0])).exceptions.length, 2);
  assert.equal(repository.events.length, 4);
  assert.equal((await service.verify(actor("human_approver"))).valid, true);
});

test("strict records reject unknown fields and oversized batches", async () => {
  const service = createReconService(new MemoryRepository());
  await assert.rejects(service.ingest(actor("demo_operator"), "transport", [{ ...records()[0], unknown: true }]), /Unrecognized|unknown/i);
  await assert.rejects(service.ingest(actor("demo_operator"), "transport", Array.from({ length: 501 }, () => records()[0])), /at most 500/);
});

test("capabilities deny unauthenticated or wrong-role mutations and workspace writes", async () => {
  const service = createReconService(new MemoryRepository());
  await assert.rejects(service.ingest(actor("agent"), "transport", records()), /capability denied/);
  await assert.rejects(service.run(actor("demo_operator"), "550e8400-e29b-41d4-a716-446655440399"), /capability denied/);
  await assert.rejects(service.ingest(actor("demo_operator", otherWorkspace), "transport", records()), /workspace isolation violation/);
  assert.throws(() => verifyDemoSession("not-a-session", secret), /invalid demo session/);
});

test("route boundary rejects unauthenticated and oversized requests without details", async () => {
  assert.equal(errorResponse(new Error("authentication required")).status, 401);
  const oversized = new Request("http://ledger.test/api/ingest/transport", { method: "POST", body: "x".repeat(256 * 1024 + 1) });
  await assert.rejects(readJsonBody(oversized), /too large/);
});

test("drafting is agent-only and correction is a separate human operator transition", async () => {
  const repository = new MemoryRepository();
  const service = createReconService(repository, () => timestamp);
  const ingested = await service.ingest(actor("demo_operator"), "transport", records(workspace, 800));
  await service.run(actor("agent"), ingested.caseIds[0]);
  const exception = (await service.get(actor("agent"), ingested.caseIds[0])).exceptions[0];
  const llm: StructuredResponsesClient = { responses: { parse: async () => ({ output_parsed: { narrative: "The variance is 200 cents.", disposition: "investigate", evidenceIds: [String(exception.evidence[0].recordId)], varianceCents: 200 } }) } };
  const draft = await service.draft(actor("agent"), ingested.caseIds[0], exception.exceptionId, { client: llm, apiKey: "dummy-key", now: () => timestamp });
  assert.equal(draft.ok, true);
  await assert.rejects(service.correct(actor("agent"), ingested.caseIds[0], { exceptionId: exception.exceptionId, disposition: "investigate", notes: "dummy" }), /capability denied/);
  const correction = await service.correct(actor("demo_operator"), ingested.caseIds[0], { exceptionId: exception.exceptionId, disposition: "reconcile", notes: "dummy correction" });
  assert.equal(correction.state, "corrected");
  assert.equal((await service.get(actor("agent"), ingested.caseIds[0])).exceptions.find((value) => value.exceptionId === exception.exceptionId)?.state, "corrected");
});
