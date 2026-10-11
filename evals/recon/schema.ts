import { createHash } from "node:crypto";
import { z } from "zod";
import { deterministicJson } from "../../src/core/fixture-hash.js";
import { reconFindingCodeSchema } from "../../src/core/recon/finding.js";
import { reconPackSchema, reconTimestampSchema } from "../../src/core/recon/record-types.js";

export const reconCaseSchema = z.object({
  caseId: z.string().uuid(),
  pack: reconPackSchema,
  records: z.array(z.unknown()).min(1),
  expectedFindings: z.array(reconFindingCodeSchema),
  notes: z.string().max(500).optional()
}).strict();
export type ReconFixtureCase = z.infer<typeof reconCaseSchema>;

export const reconManifestSchema = z.object({
  datasetId: z.string().min(1),
  pack: reconPackSchema,
  generatorVersion: z.literal("recon-fixtures-v1"),
  seed: z.string().min(1),
  schemaVersion: z.literal(1),
  generatedAt: reconTimestampSchema,
  regressionCases: z.literal(30),
  holdoutCases: z.literal(20),
  holdoutFloor: z.object({ precision: z.number().min(0).max(1), recall: z.number().min(0).max(1) }).strict(),
  regressionHash: z.string().regex(/^[a-f0-9]{64}$/),
  holdoutHash: z.string().regex(/^[a-f0-9]{64}$/)
}).strict();
export type ReconManifest = z.infer<typeof reconManifestSchema>;

export function hashReconCases(cases: readonly ReconFixtureCase[]): string {
  return createHash("sha256").update(deterministicJson(cases), "utf8").digest("hex");
}
