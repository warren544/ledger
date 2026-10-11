import assert from "node:assert/strict";
import test from "node:test";
import { evaluateRule, ruleSchema, validateRuleForProposal } from "../rules.js";

const base = {
  workspaceId: "synthetic_step5", schemaVersion: 1 as const, createdAt: "2026-10-11T12:00:00.000Z", ruleId: "550e8400-e29b-41d4-a716-446655440501", version: 1, pack: "transport" as const,
  scope: { customerId: "customer-1" }, status: "draft" as const, plainEnglish: "Suppress a tolerated transport variance",
  when: { all: [{ field: "variance_cents" as const, op: "within_bps" as const, value: 100 }] },
  then: { action: "suppress" as const, params: { approverRole: "human_approver" as const } },
  createdFromCorrectionId: "550e8400-e29b-41d4-a716-446655440502", proposerId: "550e8400-e29b-41d4-a716-446655440503", correctionAuthorId: "550e8400-e29b-41d4-a716-446655440504"
};

test("closed DSL evaluates all/any/not and numeric/string operators", () => {
  const rule = ruleSchema.parse({ ...base, when: { all: [{ any: [{ field: "variance_cents", op: "gte", value: 50 }, { field: "finding_code", op: "in", value: ["SHORT_COUNT"] }] }, { not: { field: "seal_status", op: "exists" } }] } });
  assert.equal(evaluateRule(rule, { pack: "transport", facts: { variance_cents: 75, customer_id: "customer-1" }, findingCode: "SHORT_COUNT", severity: "high" }).suppressed, true);
  assert.equal(evaluateRule(rule, { pack: "transport", facts: { variance_cents: 10, seal_status: "intact", customer_id: "customer-1" }, findingCode: "OTHER", severity: "high" }).matched, false);
  assert.equal(evaluateRule(rule, { pack: "transport", facts: { variance_cents: 75, customer_id: "other" }, findingCode: "SHORT_COUNT", severity: "high" }).matched, false);
});

test("rules reject unknown fields, malformed actions, and critical suppression", () => {
  assert.throws(() => ruleSchema.parse({ ...base, when: { field: "notes", op: "eq", value: "x" } }));
  assert.throws(() => validateRuleForProposal({ ...base, then: { action: "suppress", params: { approverRole: "agent" } } }));
  const rule = ruleSchema.parse(base);
  const effect = evaluateRule(rule, { pack: "transport", facts: { variance_cents: 50, customer_id: "customer-1" }, findingCode: "DUPLICATE_TRACE", severity: "critical" });
  assert.equal(effect.suppressed, false);
  assert.equal(effect.flagged, true);
});

test("severity actions cannot lower a finding", () => {
  const rule = ruleSchema.parse({ ...base, then: { action: "set_severity", params: { severity: "low" } } });
  assert.throws(() => evaluateRule(rule, { pack: "transport", facts: { variance_cents: 50, customer_id: "customer-1" }, findingCode: "SHORT_COUNT", severity: "high" }), /lower/);
});
