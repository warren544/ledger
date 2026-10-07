import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hashRecords } from "../src/core/fixture-hash.js";
import { canonicalFixturePaths } from "../src/core/fixture-set.js";
import { evalReportSchema } from "../src/core/eval-report.js";
import { neutralSelfTestImplementation, runEvaluation, type EvalImplementation } from "../src/server/eval-runner.js";
import { fixtureManifestSchema } from "../src/core/types.js";

const clock = { now: () => new Date("2026-10-06T00:00:00.000Z") };
const runId = "550e8400-e29b-41d4-a716-446655440020";

test("derives actual counts and preserves explicit prebuild/mock labeling", async () => {
  const result = await runEvaluation({ runId, runnerId: "test-runner", implementation: neutralSelfTestImplementation, clock });
  assert.equal(result.report.counts.total, 12); assert.equal(result.report.counts.ok, 12); assert.equal(result.report.counts.error, 0); assert.equal(result.report.implementationId, "neutral-self-test-double"); assert.equal(result.report.mode, "prebuild-plumbing"); assert.equal(result.report.domainMetrics.duplicateAccuracy, null); evalReportSchema.parse(result.report);
});

test("implementation errors become per-case errors without inventing metrics", async () => {
  let calls = 0; const implementation: EvalImplementation = { id: "explicit-test-double", evaluate: async () => { calls += 1; if (calls === 1) throw new Error("dummy implementation failure"); } };
  const result = await runEvaluation({ runId: "550e8400-e29b-41d4-a716-446655440021", runnerId: "test-runner", implementation, clock });
  assert.equal(result.report.counts.total, 12); assert.equal(result.report.counts.error, 1); assert.equal(result.report.counts.ok, 11); assert.equal(result.report.cases.find((item) => item.status === "error")?.error, "dummy implementation failure"); assert.equal(result.report.domainMetrics.precision, null);
});

test("rejects malformed reports at the schema boundary", () => { assert.throws(() => evalReportSchema.parse({ version: 1, counts: { total: 1, ok: 1, error: 0 } })); });

test("fails on a frozen manifest hash mismatch without regenerating it", async () => {
  const dir = await mkdtemp(join(process.cwd(), "eval-test-")); const paths = canonicalFixturePaths(); const manifest = fixtureManifestSchema.parse(JSON.parse(await readFile(paths.manifest, "utf8"))); const altered = { ...manifest, datasetHash: "0".repeat(64) }; const tempPaths = { records: join(dir, "records.json"), manifest: join(dir, "manifest.json") }; await writeFile(tempPaths.records, await readFile(paths.records)); await writeFile(tempPaths.manifest, JSON.stringify(altered)); await assert.rejects(() => runEvaluation({ fixturePaths: tempPaths, runId: "550e8400-e29b-41d4-a716-446655440022", runnerId: "test", implementation: neutralSelfTestImplementation, clock }), /manifest mismatch/); await rm(dir, { recursive: true, force: true });
});

test("handles a valid zero-record input with derived zero counts", async () => {
  const dir = await mkdtemp(join(process.cwd(), "eval-empty-")); const paths = canonicalFixturePaths(); const manifest = fixtureManifestSchema.parse(JSON.parse(await readFile(paths.manifest, "utf8"))); const tempPaths = { records: join(dir, "records.json"), manifest: join(dir, "manifest.json") }; await writeFile(tempPaths.records, "[]"); await writeFile(tempPaths.manifest, JSON.stringify({ ...manifest, records: 0, datasetHash: hashRecords([]) })); const result = await runEvaluation({ fixturePaths: tempPaths, runId: "550e8400-e29b-41d4-a716-446655440023", runnerId: "test", implementation: neutralSelfTestImplementation, clock }); assert.deepEqual(result.report.counts, { total: 0, ok: 0, error: 0 }); await rm(dir, { recursive: true, force: true });
});

test("never loads evaluator-only label files into runtime packets", async () => {
  const dir = await mkdtemp(join(process.cwd(), "eval-labels-")); const labelFile = join(dir, "evaluator-only-labels.json"); await writeFile(labelFile, JSON.stringify({ sentinel: "DO_NOT_LOAD" })); let sawLabel = false; const implementation: EvalImplementation = { id: "label-isolation-test-double", evaluate: async (record) => { sawLabel ||= Object.prototype.hasOwnProperty.call(record, "labels"); } }; await runEvaluation({ runId: "550e8400-e29b-41d4-a716-446655440024", runnerId: "test", implementation, clock }); assert.equal(sawLabel, false); await rm(dir, { recursive: true, force: true });
});

test("atomic report writes remove a failed temporary file", async () => {
  const dir = await mkdtemp(join(process.cwd(), "eval-atomic-")); let removed = ""; await assert.rejects(() => runEvaluation({ outputDir: dir, runId: "550e8400-e29b-41d4-a716-446655440025", runnerId: "test", implementation: neutralSelfTestImplementation, clock, fileOps: { mkdir: async () => undefined, writeFile: async () => undefined, rename: async () => { throw new Error("dummy rename failure"); }, rm: async (path) => { removed = path; } } }), /dummy rename failure/); assert.match(removed, /550e8400-e29b-41d4-a716-446655440025\.json\.tmp$/); await rm(dir, { recursive: true, force: true });
});
