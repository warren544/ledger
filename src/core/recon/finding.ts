import { z } from "zod";
import { createHash } from "node:crypto";
import { parseUuid } from "../ids.js";
import { evidenceSchema, reconUuidSchema } from "./record-types.js";
import { varianceResultSchema } from "./variance.js";

export const reconFindingCodeSchema = z.enum([
  "SHORT_COUNT", "OVER_COUNT", "BROKEN_SEAL", "MISSING_RECEIPT", "BANK_CREDIT_MISMATCH", "LATE_CREDIT", "DUPLICATE_TRACE",
  "RATE_MISMATCH", "UNBILLED_STOP", "DOUBLE_BILLED_STOP", "FUEL_SURCHARGE_OVER"
]);
export type ReconFindingCode = z.infer<typeof reconFindingCodeSchema>;

export const reconFindingSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type ReconFindingSeverity = z.infer<typeof reconFindingSeveritySchema>;

export const reconFindingSchema = z.object({
  findingId: reconUuidSchema,
  code: reconFindingCodeSchema,
  severity: reconFindingSeveritySchema,
  evidence: z.array(evidenceSchema).min(1),
  variance: varianceResultSchema.nullable()
}).strict();
export type ReconFinding = z.infer<typeof reconFindingSchema>;

const severityByCode: Record<ReconFindingCode, ReconFindingSeverity> = {
  SHORT_COUNT: "high", OVER_COUNT: "high", BROKEN_SEAL: "high", MISSING_RECEIPT: "medium", BANK_CREDIT_MISMATCH: "high", LATE_CREDIT: "medium", DUPLICATE_TRACE: "critical",
  RATE_MISMATCH: "high", UNBILLED_STOP: "high", DOUBLE_BILLED_STOP: "critical", FUEL_SURCHARGE_OVER: "medium"
};

export function findingSeverity(code: ReconFindingCode): ReconFindingSeverity {
  return severityByCode[code];
}

export function createFinding(code: ReconFindingCode, evidence: ReconFinding["evidence"], variance: ReconFinding["variance"], stableKey: string): ReconFinding {
  const digest = createHash("sha256").update(`ledger-recon-finding:v1\0${code}\0${stableKey}`, "utf8").digest("hex").slice(0, 32).split("");
  digest[12] = "4";
  digest[16] = ((Number.parseInt(digest[16], 16) & 0x3) | 0x8).toString(16);
  const findingId = parseUuid(`${digest.slice(0, 8).join("")}-${digest.slice(8, 12).join("")}-${digest.slice(12, 16).join("")}-${digest.slice(16, 20).join("")}-${digest.slice(20).join("")}`);
  return reconFindingSchema.parse({ findingId, code, severity: findingSeverity(code), evidence, variance });
}
