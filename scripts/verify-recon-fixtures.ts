import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { reconCaseSchema, reconManifestSchema, hashReconCases, type ReconFixtureCase } from "../evals/recon/schema.js";
import { billingRecordSchema } from "../src/core/recon/packs/billing.js";
import { transportRecordSchema } from "../src/core/recon/packs/transport.js";

const root = fileURLToPath(new URL("../evals/recon/", import.meta.url));

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function verifyPack(pack: "transport" | "billing"): Promise<void> {
  const directory = `${root}${pack}`;
  const [rawRegression, rawHoldout, rawManifest] = await Promise.all([readJson(`${directory}/fixtures.json`), readJson(`${directory}/cases.json`), readJson(`${directory}/manifest.json`)]);
  const regression = reconCaseSchema.array().length(30).parse(rawRegression);
  const holdout = reconCaseSchema.array().length(20).parse(rawHoldout);
  const manifest = reconManifestSchema.parse(rawManifest);
  if (manifest.pack !== pack) throw new Error(`${pack} manifest pack mismatch`);
  if (hashReconCases(regression) !== manifest.regressionHash) throw new Error(`${pack} regression hash mismatch`);
  if (hashReconCases(holdout) !== manifest.holdoutHash) throw new Error(`${pack} holdout hash mismatch`);
  const parser = pack === "transport" ? transportRecordSchema : billingRecordSchema;
  for (const item of [...regression, ...holdout]) {
    if (item.pack !== pack) throw new Error(`${pack} case pack mismatch`);
    parser.array().parse(item.records);
  }
  const faultCount = regression.filter((item) => item.expectedFindings.length > 0).length;
  if (faultCount !== 12) throw new Error(`${pack} regression set must contain exactly 12 labeled fault cases`);
  console.log(`Verified ${pack}: ${regression.length} regression cases, ${holdout.length} holdout cases, regression ${manifest.regressionHash}, holdout ${manifest.holdoutHash}.`);
}

await Promise.all([verifyPack("transport"), verifyPack("billing")]);
