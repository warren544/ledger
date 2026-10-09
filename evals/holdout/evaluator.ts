import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { deterministicJson } from "../../src/core/fixture-hash.js";

const uuidSchema = z.string().uuid();
const invoiceSchema = z.object({
  customerId: uuidSchema,
  vendorId: uuidSchema,
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().nonnegative(),
  currency: z.literal("USD"),
  serviceCode: z.string().min(1),
  documentNumber: z.string().min(1)
}).strict();

export const holdoutCaseSchema = z.object({
  caseId: uuidSchema,
  left: invoiceSchema,
  right: invoiceSchema,
  expectedDuplicate: z.boolean()
}).strict();

export const holdoutManifestSchema = z.object({
  datasetId: z.literal("ledger-frozen-holdout-v1"),
  evaluatorVersion: z.literal("baseline-exact-fingerprint-v1"),
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime({ offset: true }),
  cases: z.literal(20),
  datasetHash: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();

export const holdoutResultSchema = z.object({
  caseId: uuidSchema,
  expectedDuplicate: z.boolean(),
  predictedDuplicate: z.boolean().nullable(),
  status: z.enum(["ok", "error"]),
  error: z.string().max(500).nullable()
}).strict();

export const holdoutReportSchema = z.object({
  version: z.literal(1),
  datasetId: z.literal("ledger-frozen-holdout-v1"),
  datasetHash: z.string().regex(/^[a-f0-9]{64}$/),
  evaluatorId: z.literal("baseline-exact-fingerprint-v1"),
  cases: z.literal(20),
  results: z.array(holdoutResultSchema).length(20),
  runnable: z.boolean(),
  metrics: z.object({
    precision: z.number().min(0).max(1).nullable(),
    recall: z.number().min(0).max(1).nullable(),
    confusion: z.object({ tp: z.number().int().nonnegative().nullable(), fp: z.number().int().nonnegative().nullable(), fn: z.number().int().nonnegative().nullable(), tn: z.number().int().nonnegative().nullable() }).strict()
  }).strict(),
  metricError: z.string().nullable()
}).strict();

export type HoldoutCase = z.infer<typeof holdoutCaseSchema>;
export type HoldoutReport = z.infer<typeof holdoutReportSchema>;

const casesPath = fileURLToPath(new URL("./cases.json", import.meta.url));
const manifestPath = fileURLToPath(new URL("./manifest.json", import.meta.url));

function safeError(error: unknown): string { return (error instanceof Error ? error.message : "case evaluation failed").slice(0, 500); }

function fingerprint(invoice: HoldoutCase["left"]): string {
  return deterministicJson({ customerId: invoice.customerId, vendorId: invoice.vendorId, invoiceDate: invoice.invoiceDate, amountCents: invoice.amountCents, currency: invoice.currency, serviceCode: invoice.serviceCode });
}

/** Baseline defined before the frozen run: exact business-field fingerprint, excluding document number. */
export function baselinePredictsDuplicate(input: Pick<HoldoutCase, "left" | "right">): boolean { return fingerprint(input.left) === fingerprint(input.right); }

async function readJson(path: string): Promise<unknown> { return JSON.parse(await readFile(path, "utf8")) as unknown; }

export async function readFrozenHoldout(): Promise<{ cases: HoldoutCase[]; manifest: z.infer<typeof holdoutManifestSchema> }> {
  const [rawCases, rawManifest] = await Promise.all([readJson(casesPath), readJson(manifestPath)]);
  const cases = z.array(holdoutCaseSchema).length(20).parse(rawCases);
  const manifest = holdoutManifestSchema.parse(rawManifest);
  const uniqueIds = new Set(cases.map((item) => item.caseId));
  if (uniqueIds.size !== cases.length) throw new Error("holdout contains duplicate case IDs");
  const datasetHash = hashHoldoutCases(cases);
  if (datasetHash !== manifest.datasetHash) throw new Error("frozen holdout dataset hash mismatch");
  return { cases, manifest };
}

export function hashHoldoutCases(cases: HoldoutCase[]): string {
  return createHash("sha256").update(Buffer.from(deterministicJson(cases), "utf8")).digest("hex");
}

export async function runFrozenHoldout(options: { readonly evaluate?: (item: HoldoutCase) => boolean | Promise<boolean> } = {}): Promise<HoldoutReport> {
  const { cases, manifest } = await readFrozenHoldout();
  const evaluate = options.evaluate ?? baselinePredictsDuplicate;
  const results = [] as HoldoutReport["results"];
  for (const item of cases) {
    try { results.push({ caseId: item.caseId, expectedDuplicate: item.expectedDuplicate, predictedDuplicate: await evaluate(structuredClone(item)), status: "ok", error: null }); }
    catch (error) { results.push({ caseId: item.caseId, expectedDuplicate: item.expectedDuplicate, predictedDuplicate: null, status: "error", error: safeError(error) }); }
  }
  const failed = results.some((item) => item.status === "error");
  let metrics: HoldoutReport["metrics"];
  let metricError: string | null = null;
  if (failed) {
    metrics = { precision: null, recall: null, confusion: { tp: null, fp: null, fn: null, tn: null } };
    metricError = "one or more holdout cases could not run; aggregate metrics are null";
  } else {
    const tp = results.filter((item) => item.expectedDuplicate && item.predictedDuplicate).length;
    const fp = results.filter((item) => !item.expectedDuplicate && item.predictedDuplicate === true).length;
    const fn = results.filter((item) => item.expectedDuplicate && item.predictedDuplicate === false).length;
    const tn = results.filter((item) => !item.expectedDuplicate && item.predictedDuplicate === false).length;
    metrics = { precision: tp + fp === 0 ? null : tp / (tp + fp), recall: tp + fn === 0 ? null : tp / (tp + fn), confusion: { tp, fp, fn, tn } };
  }
  return holdoutReportSchema.parse({ version: 1, datasetId: manifest.datasetId, datasetHash: manifest.datasetHash, evaluatorId: manifest.evaluatorVersion, cases: cases.length, results, runnable: !failed, metrics, metricError });
}
