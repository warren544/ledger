import { test } from "node:test";
import assert from "node:assert/strict";
import { holdoutManifestSchema, readFrozenHoldout, runFrozenHoldout } from "../evals/holdout/evaluator.js";

test("loads exactly the frozen labeled 20-case holdout", async () => {
  const { cases, manifest } = await readFrozenHoldout();
  assert.equal(cases.length, 20);
  assert.equal(manifest.cases, 20);
  holdoutManifestSchema.parse(manifest);
});

test("derives the baseline metrics from predictions", async () => {
  const report = await runFrozenHoldout();
  assert.equal(report.runnable, true);
  assert.deepEqual(report.metrics, { precision: 0.8, recall: 0.8, confusion: { tp: 8, fp: 2, fn: 2, tn: 8 } });
  assert.equal(report.results.filter((item) => item.status === "ok").length, 20);
});

test("nulls aggregate metrics when a case cannot run", async () => {
  const report = await runFrozenHoldout({ evaluate: async (item) => { if (item.caseId.endsWith("120")) throw new Error("intentional test failure"); return false; } });
  assert.equal(report.runnable, false);
  assert.deepEqual(report.metrics, { precision: null, recall: null, confusion: { tp: null, fp: null, fn: null, tn: null } });
  assert.match(report.metricError ?? "", /could not run/);
  assert.equal(report.results.find((item) => item.caseId.endsWith("120"))?.error, "intentional test failure");
});
