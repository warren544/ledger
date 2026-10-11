import { z } from "zod";
import { cents, type MoneyCents } from "../money.js";
import { parseUuid, type UUID } from "../ids.js";

export const RECON_SCHEMA_VERSION = 1 as const;

export const reconPackSchema = z.enum(["transport", "billing"]);
export type ReconPack = z.infer<typeof reconPackSchema>;

export const reconMoneySchema = z.number().int().safe().transform((value) => cents(value));
export type ReconMoney = z.infer<typeof reconMoneySchema>;

export const reconWorkspaceIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/);
export const reconTimestampSchema = z.string().refine((value) => value.endsWith("Z") && !Number.isNaN(Date.parse(value)), "must be an ISO UTC timestamp");
export const reconHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const reconUuidSchema = z.string().uuid().transform((value) => parseUuid(value));

export const reconRecordSchema = z.object({
  recordId: reconUuidSchema,
  workspaceId: reconWorkspaceIdSchema,
  schemaVersion: z.literal(RECON_SCHEMA_VERSION),
  sourceSystem: z.string().min(1).max(100),
  recordedAt: reconTimestampSchema,
  contentHash: reconHashSchema
}).strict();
export type ReconRecord = z.infer<typeof reconRecordSchema>;

export const evidenceSchema = z.object({
  recordId: reconUuidSchema,
  kind: z.string().min(1).max(100),
  field: z.string().min(1).max(200),
  value: z.unknown()
}).strict();
export type Evidence = z.infer<typeof evidenceSchema>;

export const reconCaseStatusSchema = z.enum(["open", "clean", "excepted", "resolved"]);
export type ReconCaseStatus = z.infer<typeof reconCaseStatusSchema>;

export const reconCaseSchema = z.object({
  caseId: reconUuidSchema,
  workspaceId: reconWorkspaceIdSchema,
  pack: reconPackSchema,
  key: z.string().min(1).max(500),
  recordIds: z.array(reconUuidSchema).min(1),
  status: reconCaseStatusSchema
}).strict();
export type ReconCase = z.infer<typeof reconCaseSchema>;

export function asReconMoney(value: MoneyCents): ReconMoney {
  return cents(value);
}

export type ReconUuid = UUID;
