import { createHash } from "node:crypto";
import { runReconCase } from "./engine.js";
import { evaluateRule, type ReconRule } from "../../core/recon/rules.js";
import type { ReconFinding } from "../../core/recon/finding.js";

export interface ReplayCase { readonly caseId: string; readonly records: readonly unknown[]; readonly expectedFindings: readonly string[] }
export interface Confusion { readonly tp: number; readonly fp: number; readonly fn: number; readonly tn: number }
export interface ReplayMetrics { readonly precision: number | null; readonly recall: number | null; readonly confusion: Confusion; readonly criticalMisses: number; readonly exceptionDelta: number }
export interface ReplayReport { readonly pack: "transport" | "billing"; readonly before: ReplayMetrics; readonly after: ReplayMetrics; readonly reportHash: string; readonly holdoutId: string }

const criticalCodes = new Set(["DUPLICATE_TRACE", "DOUBLE_BILLED_STOP"]);

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

function hash(value: unknown): string { return createHash("sha256").update(stable(value), "utf8").digest("hex"); }

function findingFacts(finding: ReconFinding): Record<string, unknown> {
  const facts: Record<string, unknown> = { finding_code: finding.code, variance_cents: finding.variance?.varianceCents };
  for (const item of finding.evidence) facts[item.field] = item.value;
  return facts;
}

function applyRule(findings: readonly ReconFinding[], rule: ReconRule | undefined): ReconFinding[] {
  if (!rule) return [...findings];
  return findings.flatMap((finding) => {
    const effect = evaluateRule(rule, { pack: rule.pack, facts: findingFacts(finding), findingCode: finding.code, severity: finding.severity });
    return effect.suppressed ? [] : [{ ...finding, severity: effect.severity }];
  });
}

function metrics(cases: readonly ReplayCase[], pack: "transport" | "billing", rule: ReconRule | undefined): ReplayMetrics {
  let tp = 0; let fp = 0; let fn = 0; let tn = 0; let criticalMisses = 0; let exceptionDelta = 0;
  for (const item of cases) {
    const actual = runReconCase({ caseId: item.caseId, pack, records: item.records });
    const findings = applyRule(actual.findings, rule);
    const expected = item.expectedFindings.length > 0;
    const predicted = findings.length > 0;
    if (expected && predicted) tp += 1;
    else if (!expected && predicted) fp += 1;
    else if (expected) fn += 1;
    else tn += 1;
    exceptionDelta += findings.length - actual.findings.length;
    if (item.expectedFindings.some((code) => criticalCodes.has(code)) && !findings.some((finding) => criticalCodes.has(finding.code))) criticalMisses += 1;
  }
  const predictedPositive = tp + fp;
  const expectedPositive = tp + fn;
  return { precision: predictedPositive === 0 ? null : tp / predictedPositive, recall: expectedPositive === 0 ? null : tp / expectedPositive, confusion: { tp, fp, fn, tn }, criticalMisses, exceptionDelta };
}

/** Runs deterministic cases under explicit before/after rule versions; it never changes source records. */
export function replayRecon(input: { readonly pack: "transport" | "billing"; readonly cases: readonly ReplayCase[]; readonly before?: ReconRule; readonly after?: ReconRule; readonly holdoutId: string }): ReplayReport {
  const before = metrics(input.cases, input.pack, input.before);
  const after = metrics(input.cases, input.pack, input.after);
  const report = { pack: input.pack, before, after, holdoutId: input.holdoutId };
  return { ...report, reportHash: hash(report) };
}

export function meetsFrozenFloor(report: ReplayReport, floor: { precision: number; recall: number }): boolean {
  return report.after.precision !== null && report.after.recall !== null && report.after.precision >= floor.precision && report.after.recall >= floor.recall && report.after.criticalMisses === 0;
}
