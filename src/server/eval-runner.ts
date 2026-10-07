import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { evalReportSchema, type EvalCase, type EvalReport } from "../core/eval-report.js";
import { hashRecords } from "../core/fixture-hash.js";
import { readFixtureData, type FixturePaths } from "../core/fixture-set.js";
import type { SyntheticRecord } from "../core/types.js";

export interface EvalImplementation { readonly id: string; evaluate(record: SyntheticRecord): Promise<void>; }
export const neutralSelfTestImplementation: EvalImplementation = { id: "neutral-self-test-double", async evaluate(record) { if (record.source !== "synthetic") throw new Error("record source rejected"); } };
export interface EvalClock { now(): Date; }
export interface EvalFileOps { mkdir(path: string, options: { readonly recursive: true }): Promise<unknown>; writeFile(path: string, data: string, encoding: "utf8"): Promise<void>; rename(oldPath: string, newPath: string): Promise<void>; rm(path: string, options: { readonly force: true }): Promise<void>; }
const defaultFileOps: EvalFileOps = { mkdir, writeFile, rename, rm };

function safeError(error: unknown): string { return (error instanceof Error ? error.message : "implementation failed").slice(0, 500); }
export async function runEvaluation(options: { readonly fixturePaths?: FixturePaths; readonly outputDir?: string; readonly runId: string; readonly runnerId: string; readonly implementation: EvalImplementation; readonly clock: EvalClock; readonly fileOps?: EvalFileOps }): Promise<{ readonly report: EvalReport; readonly outputPath?: string }> {
  const fixture = await readFixtureData(options.fixturePaths);
  const computedHash = hashRecords(fixture.records);
  if (computedHash !== fixture.manifest.datasetHash) throw new Error("evaluation dataset hash mismatch");
  const startedAt = options.clock.now().toISOString(); const cases: EvalCase[] = [];
  for (const record of fixture.records) {
    try { await options.implementation.evaluate(structuredClone(record)); cases.push({ caseId: record.id, status: "ok", error: null }); }
    catch (error) { cases.push({ caseId: record.id, status: "error", error: safeError(error) }); }
  }
  const report = evalReportSchema.parse({ version: 1, runId: options.runId, datasetId: fixture.manifest.datasetId, datasetHash: computedHash, runnerId: options.runnerId, implementationId: options.implementation.id, mode: "prebuild-plumbing", source: "fixture", startedAt, finishedAt: options.clock.now().toISOString(), counts: { total: cases.length, ok: cases.filter((item) => item.status === "ok").length, error: cases.filter((item) => item.status === "error").length }, cases, domainMetrics: { duplicateAccuracy: null, splitAccuracy: null, precision: null, recall: null } });
  if (!options.outputDir) return { report };
  const ops = options.fileOps ?? defaultFileOps; await ops.mkdir(options.outputDir, { recursive: true }); const outputPath = join(options.outputDir, `${report.runId}.json`); const tempPath = `${outputPath}.tmp`; try { await ops.writeFile(tempPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"); await ops.rename(tempPath, outputPath); } catch (error) { await ops.rm(tempPath, { force: true }); throw error; }
  return { report, outputPath };
}
