import assert from "node:assert/strict";
import test from "node:test";
import { appendHashChainEntry, verifyHashChain, type HashChainEntry } from "../../src/core/hash-chain.js";
import { createRuleService } from "../../src/server/recon/approval.js";
import { DEMO_ACTORS, issueDemoSession, verifyDemoSession, type ReconActor } from "../../src/server/recon/auth.js";
import { readFrozenRuleSet } from "../../src/server/recon/holdout.js";
import type { ReconCase } from "../../src/core/recon/record-types.js";
import type { ReconException } from "../../src/core/recon/exception.js";
import type { ReconRule } from "../../src/core/recon/rules.js";
import type { ReconCorrection, ReconEventInput, ReconRepository, StoredReconEvent } from "../../src/server/recon/repository.js";

const workspace = "synthetic_step5";
const secret = "dummy-step5-secret";
const actor = (role: "agent" | "demo_operator" | "human_approver", workspaceId = workspace): ReconActor => verifyDemoSession(issueDemoSession(role, workspaceId, secret, 1_000, 10_000), secret, 2_000);

class MemoryRepository implements ReconRepository {
  readonly corrections: ReconCorrection[] = [];
  readonly rules = new Map<string, ReconRule>();
  readonly events: StoredReconEvent[] = [];
  async upsertRecord(_record: Record<string, unknown>) {}
  async upsertCase(_value: ReconCase) {}
  async updateCase(_value: ReconCase) {}
  async getCase(_workspaceId: string, _caseId: string) { return null; }
  async listCases(_workspaceId: string, _pack?: string, _status?: string) { return []; }
  async getRecords(_workspaceId: string, _ids: readonly string[]) { return []; }
  async insertException(_value: ReconException) {}
  async updateException(_value: ReconException) {}
  async getException(_workspaceId: string, _id: string) { return null; }
  async listExceptions(_workspaceId: string, _caseId: string) { return []; }
  async saveDraft(_workspaceId: string, _id: string, _draft: import("../../src/server/recon/drafter.js").StoredDraft) {}
  async getDraft(_workspaceId: string, _id: string) { return null; }
  async insertCorrection(value: ReconCorrection) { this.corrections.push(value); }
  async getCorrection(workspaceId: string, correctionId: string) { return this.corrections.find((value) => value.workspaceId === workspaceId && value.correctionId === correctionId) ?? null; }
  async insertRule(value: ReconRule) { this.rules.set(`${value.workspaceId}:${value.ruleId}:${value.version}`, structuredClone(value)); }
  async updateRule(value: ReconRule) { this.rules.set(`${value.workspaceId}:${value.ruleId}:${value.version}`, structuredClone(value)); }
  async getRule(workspaceId: string, ruleId: string, version?: number) { return [...this.rules.values()].find((value) => value.workspaceId === workspaceId && value.ruleId === ruleId && (version === undefined || version === value.version)) ?? null; }
  async listRules(workspaceId: string) { return [...this.rules.values()].filter((value) => value.workspaceId === workspaceId); }
  async listEvents(workspaceId: string, subjectId?: string) { return this.events.filter((value) => value.workspaceId === workspaceId && (subjectId === undefined || value.subjectId === subjectId)); }
  async appendEvent(input: ReconEventInput) {
    const chain = this.events.filter((value) => value.workspaceId === input.workspaceId).sort((a, b) => a.chain.index - b.chain.index).map((value) => value.chain);
    const next = appendHashChainEntry(chain, input.payload).at(-1) as HashChainEntry;
    const event: StoredReconEvent = { schemaVersion: 1, workspaceId: input.workspaceId, eventId: `event-${this.events.length + 1}`, actorId: input.actorId, subjectId: input.subjectId, type: input.type, createdAt: "2026-10-11T12:00:00.000Z", chain: next };
    this.events.push(event); return event;
  }
  async verifyEvents(workspaceId: string) { const chain = this.events.filter((value) => value.workspaceId === workspaceId).sort((a, b) => a.chain.index - b.chain.index).map((value) => value.chain); const result = verifyHashChain(chain); return result.valid ? { valid: true, count: result.count, head: result.head, index: null } : { valid: false, count: chain.length, head: "", index: result.index, reason: result.reason }; }
}

test("proposal -> frozen evaluation -> separate approval -> rollback is versioned", async () => {
  const repository = new MemoryRepository();
  const service = createRuleService(repository, () => "2026-10-11T12:00:00.000Z");
  const correctionAuthor = actor("demo_operator");
  const proposer = actor("agent");
  const approver = actor("human_approver");
  const correctionId = "550e8400-e29b-41d4-a716-446655440601";
  await repository.insertCorrection({ schemaVersion: 1, correctionId, workspaceId: workspace, caseId: "550e8400-e29b-41d4-a716-446655440602", exceptionId: "550e8400-e29b-41d4-a716-446655440603", actorId: correctionAuthor.actorId, disposition: "investigate", notes: "dummy correction", createdAt: "2026-10-11T12:00:00.000Z" });
  const rule = await service.propose(proposer, { pack: "transport", correctionId }, async () => ({ plainEnglish: "A rule that matches no finding", when: { field: "finding_code", op: "eq", value: "NEVER_MATCH" }, then: { action: "flag", params: {} } }));
  const set = await readFrozenRuleSet("transport");
  const evaluated = await service.evaluate(correctionAuthor, rule.ruleId, set);
  assert.equal(evaluated.rule.status, "evaluated");
  await assert.rejects(service.approve(approver, rule.ruleId, { evalReportHash: "0".repeat(64) }), /stale/);
  await assert.rejects(service.approve(proposer, rule.ruleId, { evalReportHash: evaluated.report.reportHash }), /capability denied/);
  const active = await service.approve(approver, rule.ruleId, { evalReportHash: evaluated.report.reportHash });
  assert.equal(active.status, "active");
  const rolledBack = await service.rollback(approver, rule.ruleId);
  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(rolledBack.version, active.version + 1);
  const billing = await readFrozenRuleSet("billing");
  const billingReplay = await service.replay(proposer, { ...billing, holdoutId: billing.holdoutId });
  assert.deepEqual(billingReplay.after.confusion, { tp: 8, fp: 0, fn: 0, tn: 12 });
  assert.equal((await repository.verifyEvents(workspace)).valid, true);
});

test("rule proposal and approval stay workspace-scoped", async () => {
  const repository = new MemoryRepository();
  const service = createRuleService(repository);
  const other = actor("agent", "synthetic_other_step5");
  await assert.rejects(service.propose(other, { pack: "transport", correctionId: "550e8400-e29b-41d4-a716-446655440601" }, async () => ({ plainEnglish: "x", when: { field: "finding_code", op: "eq", value: "x" }, then: { action: "flag", params: {} } })), /correction not found/);
  assert.equal(other.actorId, DEMO_ACTORS.agent);
});
