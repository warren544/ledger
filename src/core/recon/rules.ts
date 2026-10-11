import { z } from "zod";
import { reconPackSchema, reconWorkspaceIdSchema } from "./record-types.js";
import { reconFindingSeveritySchema, type ReconFindingSeverity } from "./finding.js";

export const ruleStatusSchema = z.enum(["draft", "evaluated", "approved", "active", "rolled_back"]);
export type RuleStatus = z.infer<typeof ruleStatusSchema>;
export const approverRoleSchema = z.enum(["human_approver"]);

const idValue = z.string().min(1).max(200);
const scopeSchema = z.object({
  customerId: idValue.optional(), terminalId: idValue.optional(), routeId: idValue.optional(), kind: idValue.optional()
}).strict().refine((value) => Object.keys(value).length > 0, "rule scope must narrow at least one field");

const transportFields = z.enum(["declared_cents", "counted_cents", "credited_cents", "variance_cents", "seal_status", "value_date", "scheduled_at", "customer_id", "route_id", "stop_id", "ach_trace_id", "finding_code"]);
const billingFields = z.enum(["unit_cents", "total_cents", "qty", "variance_cents", "kind", "stop_id", "customer_id", "period_start", "period_end", "performed_at", "finding_code"]);
export type RuleField = z.infer<typeof transportFields> | z.infer<typeof billingFields>;

const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const leafOps = z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "within_bps", "in", "missing", "exists"]);

function conditionSchema(fields: z.ZodType<RuleField>) {
  const leaf = z.object({ field: fields, op: leafOps, value: z.union([scalar, z.array(scalar)]).optional() }).strict().superRefine((value, context) => {
    if (!["missing", "exists"].includes(value.op) && value.value === undefined) context.addIssue({ code: "custom", message: "condition value is required" });
    if (["missing", "exists"].includes(value.op) && value.value !== undefined) context.addIssue({ code: "custom", message: "presence conditions do not accept a value" });
    if (value.op === "in" && !Array.isArray(value.value)) context.addIssue({ code: "custom", message: "in requires an array" });
    if (value.op !== "in" && Array.isArray(value.value)) context.addIssue({ code: "custom", message: "only in accepts an array" });
  });
  type Condition = z.infer<typeof leaf> | { all: Condition[] } | { any: Condition[] } | { not: Condition };
  const condition: z.ZodType<Condition> = z.lazy(() => z.union([
    leaf,
    z.object({ all: z.array(condition).min(1) }).strict(),
    z.object({ any: z.array(condition).min(1) }).strict(),
    z.object({ not: condition }).strict()
  ]));
  return condition;
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("flag"), params: z.object({}).strict() }).strict(),
  z.object({ action: z.literal("suppress"), params: z.object({ approverRole: approverRoleSchema }).strict() }).strict(),
  z.object({ action: z.literal("set_severity"), params: z.object({ severity: reconFindingSeveritySchema }).strict() }).strict(),
  z.object({ action: z.literal("require_approver_role"), params: z.object({ role: approverRoleSchema }).strict() }).strict()
]);

const evalReportSchema = z.object({
  precision: z.number().min(0).max(1), recall: z.number().min(0).max(1),
  tp: z.number().int().nonnegative(), fp: z.number().int().nonnegative(), fn: z.number().int().nonnegative(), tn: z.number().int().nonnegative(),
  holdoutId: z.string().min(1).max(200), reportHash: z.string().regex(/^[a-f0-9]{64}$/), ruleVersion: z.number().int().positive(), rulePayloadHash: z.string().regex(/^[a-f0-9]{64}$/), criticalFalseNegatives: z.number().int().nonnegative()
}).strict();

const baseRule = {
  workspaceId: reconWorkspaceIdSchema, schemaVersion: z.literal(1), createdAt: z.string().datetime({ offset: true }), ruleId: z.string().uuid(), version: z.number().int().positive(), scope: scopeSchema,
  status: ruleStatusSchema, plainEnglish: z.string().min(1).max(2000), then: actionSchema,
  evalReport: evalReportSchema.optional(), approvedBy: z.string().uuid().optional(), approvedAt: z.string().datetime({ offset: true }).optional(),
  createdFromCorrectionId: z.string().uuid(), proposerId: z.string().uuid(), correctionAuthorId: z.string().uuid()
};

export const transportRuleSchema = z.object({ ...baseRule, pack: z.literal("transport"), when: conditionSchema(transportFields) }).strict();
export const billingRuleSchema = z.object({ ...baseRule, pack: z.literal("billing"), when: conditionSchema(billingFields) }).strict();
export const ruleSchema = z.discriminatedUnion("pack", [transportRuleSchema, billingRuleSchema]);
export type ReconRule = z.infer<typeof ruleSchema>;
export type RuleCondition = ReconRule["when"];
export type RuleAction = z.infer<typeof actionSchema>;

const severityRank: Record<ReconFindingSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const fieldAliases: Record<string, RuleField> = {
  declaredCents: "declared_cents", countedCents: "counted_cents", creditedCents: "credited_cents", varianceCents: "variance_cents",
  sealStatus: "seal_status", valueDate: "value_date", scheduledAt: "scheduled_at", customerId: "customer_id", routeId: "route_id",
  stopId: "stop_id", achTraceId: "ach_trace_id", unitCents: "unit_cents", totalCents: "total_cents", qty: "qty", kind: "kind",
  periodStart: "period_start", periodEnd: "period_end", performedAt: "performed_at", findingCode: "finding_code"
};

export interface RuleEvaluationContext {
  readonly pack: "transport" | "billing";
  readonly facts: Readonly<Record<string, unknown>>;
  readonly findingCode: string;
  readonly severity: ReconFindingSeverity;
}

function valueFor(field: string, facts: Readonly<Record<string, unknown>>): unknown {
  const direct = facts[field];
  return direct === undefined ? facts[fieldAliases[field] ?? field] : direct;
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function matches(condition: RuleCondition, facts: Readonly<Record<string, unknown>>): boolean {
  if ("all" in condition) return condition.all.every((item) => matches(item as RuleCondition, facts));
  if ("any" in condition) return condition.any.some((item) => matches(item as RuleCondition, facts));
  if ("not" in condition) return !matches(condition.not as RuleCondition, facts);
  const actual = valueFor(condition.field, facts);
  if (condition.op === "missing") return actual === undefined || actual === null;
  if (condition.op === "exists") return actual !== undefined && actual !== null;
  const expected = condition.value;
  switch (condition.op) {
    case "eq": return same(actual, expected);
    case "neq": return !same(actual, expected);
    case "in": return Array.isArray(expected) && expected.some((item) => same(actual, item));
    case "gt": return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte": return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lt": return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte": return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "within_bps": return typeof actual === "number" && typeof expected === "number" && Math.abs(actual) <= expected;
  }
}

export interface RuleEffect {
  readonly matched: boolean;
  readonly flagged: boolean;
  readonly suppressed: boolean;
  readonly severity: ReconFindingSeverity;
  readonly requiredApproverRole: "human_approver" | null;
}

/** Pure, closed-field rule evaluation. Rules never mutate records, amounts, capabilities, or the chain. */
export function evaluateRule(ruleInput: unknown, context: RuleEvaluationContext): RuleEffect {
  const rule = ruleSchema.parse(ruleInput);
  if (rule.pack !== context.pack) throw new Error("rule pack does not match evaluation context");
  const scopedFacts = { ...context.facts, finding_code: context.findingCode };
  const scopeMatches = Object.entries(rule.scope).every(([field, expected]) => same(valueFor(field, scopedFacts), expected));
  const matched = scopeMatches && matches(rule.when, scopedFacts);
  if (!matched) return { matched: false, flagged: false, suppressed: false, severity: context.severity, requiredApproverRole: null };
  const required = rule.then.action === "require_approver_role" ? rule.then.params.role : rule.then.action === "suppress" ? rule.then.params.approverRole : null;
  if (rule.then.action === "suppress") {
    if (context.severity === "critical") return { matched: true, flagged: true, suppressed: false, severity: context.severity, requiredApproverRole: required };
    return { matched: true, flagged: false, suppressed: true, severity: context.severity, requiredApproverRole: required };
  }
  if (rule.then.action === "set_severity") {
    const severity = rule.then.params.severity;
    if (severityRank[severity] < severityRank[context.severity]) throw new Error("rule cannot lower finding severity");
    return { matched: true, flagged: true, suppressed: false, severity, requiredApproverRole: null };
  }
  return { matched: true, flagged: true, suppressed: false, severity: context.severity, requiredApproverRole: required };
}

export function validateRuleForProposal(input: unknown): ReconRule {
  const rule = ruleSchema.parse(input);
  if (rule.status !== "draft") throw new Error("new rules must start in draft status");
  if (rule.then.action === "suppress" && rule.then.params.approverRole !== "human_approver") throw new Error("suppress requires human_approver");
  return rule;
}

export { evalReportSchema, severityRank };
