import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { reconCaseSchema, reconManifestSchema, type ReconManifest } from "../../../evals/recon/schema.js";
import type { FrozenRuleEvaluationSet } from "./approval.js";

/** Evaluation-only reader: labels are supplied to scoring, never to the runtime engine packet. */
export async function readFrozenRuleSet(pack: "transport" | "billing"): Promise<FrozenRuleEvaluationSet> {
  const directory = join(dirname(fileURLToPath(import.meta.url)), "../../../evals/recon");
  const manifest = reconManifestSchema.parse(JSON.parse(await readFile(join(directory, pack, "manifest.json"), "utf8")) as unknown) as ReconManifest;
  const cases = reconCaseSchema.array().length(manifest.holdoutCases).parse(JSON.parse(await readFile(join(directory, pack, "cases.json"), "utf8")) as unknown);
  return { pack, holdoutId: manifest.datasetId, cases: cases.map((item) => ({ caseId: item.caseId, records: item.records, expectedFindings: item.expectedFindings })), floor: manifest.holdoutFloor };
}
