import "../src/lib/load-env.js";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { hashReconCases, reconCaseSchema, reconManifestSchema, type ReconFixtureCase } from "../evals/recon/schema.js";
import { runReconCase } from "../src/server/recon/engine.js";

const root = fileURLToPath(new URL("../evals/recon/", import.meta.url));
const reportPath = fileURLToPath(new URL("../evals/reports/recon-baseline.json", import.meta.url));

const confusionSchema = z.object({ tp: z.number().int().nonnegative(), fp: z.number().int().nonnegative(), fn: z.number().int().nonnegative(), tn: z.number().int().nonnegative() }).strict();
const metricsSchema = z.object({ precision: z.number().min(0).max(1).nullable(), recall: z.number().min(0).max(1).nullable(), confusion: confusionSchema }).strict();
const floorSchema = z.object({ precision: z.number().min(0).max(1), recall: z.number().min(0).max(1) }).strict();
const reconEvalReportSchema = z.object({ version: z.literal(1), generatedAt: z.string(), packs: z.array(z.object({ pack: z.enum(["transport", "billing"]), regressionCases: z.number().int(), regressionCorrect: z.number().int(), regressionPassed: z.boolean(), regressionHash: z.string(), holdoutCases: z.number().int(), holdoutHash: z.string(), floor: floorSchema, metrics: metricsSchema }).strict()).length(2), implementation: z.literal("deterministic-default-pack-checks") }).strict();

async function json(path: string): Promise<unknown> { return JSON.parse(await readFile(path, "utf8")) as unknown; }

function metrics(expected: boolean[], predicted: boolean[]) {
  const tp = expected.filter((value, index) => value && predicted[index]).length;
  const fp = expected.filter((value, index) => !value && predicted[index]).length;
  const fn = expected.filter((value, index) => value && !predicted[index]).length;
  const tn = expected.filter((value, index) => !value && !predicted[index]).length;
  return { precision: tp + fp === 0 ? null : tp / (tp + fp), recall: tp + fn === 0 ? null : tp / (tp + fn), confusion: { tp, fp, fn, tn } };
}

async function evaluatePack(pack: "transport" | "billing") {
  const directory = `${root}${pack}`;
  const regression = reconCaseSchema.array().length(30).parse(await json(`${directory}/fixtures.json`));
  const holdout = reconCaseSchema.array().length(20).parse(await json(`${directory}/cases.json`));
  const manifest = reconManifestSchema.parse(await json(`${directory}/manifest.json`));
  if (hashReconCases(regression) !== manifest.regressionHash || hashReconCases(holdout) !== manifest.holdoutHash) throw new Error(`${pack} frozen hash mismatch`);
  const run = (item: ReconFixtureCase) => runReconCase({ caseId: item.caseId, pack: item.pack, records: item.records });
  let regressionCorrect = 0;
  for (const item of regression) {
    const result = run(item);
    const actual = result.findings.map((finding) => finding.code).sort();
    const expected = [...item.expectedFindings].sort();
    if (JSON.stringify(actual) === JSON.stringify(expected)) regressionCorrect += 1;
  }
  const expected = holdout.map((item) => item.expectedFindings.length > 0);
  const predicted = holdout.map((item) => run(item).findings.length > 0);
  const measured = metrics(expected, predicted);
  if (measured.precision === null || measured.recall === null || measured.precision < manifest.holdoutFloor.precision || measured.recall < manifest.holdoutFloor.recall) throw new Error(`${pack} holdout fell below its frozen precision/recall floor`);
  return { pack, regressionCases: regression.length, regressionCorrect, regressionPassed: regressionCorrect === regression.length, regressionHash: manifest.regressionHash, holdoutCases: holdout.length, holdoutHash: manifest.holdoutHash, floor: manifest.holdoutFloor, metrics: measured };
}

const report = reconEvalReportSchema.parse({ version: 1, generatedAt: "2026-10-11T09:00:00.000Z", packs: await Promise.all([evaluatePack("transport"), evaluatePack("billing")]), implementation: "deterministic-default-pack-checks" });
if (report.packs.some((pack) => !pack.regressionPassed)) throw new Error("reconciliation regression cases failed");
await mkdir(fileURLToPath(new URL("../evals/reports/", import.meta.url)), { recursive: true });
const temporaryPath = `${reportPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
await rename(temporaryPath, reportPath);
console.log(JSON.stringify(report, null, 2));
