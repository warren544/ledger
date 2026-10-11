import { z } from "zod";
import { billingDefaultChecks, billingRecordSchema } from "../../core/recon/packs/billing.js";
import { transportDefaultChecks, transportRecordSchema } from "../../core/recon/packs/transport.js";
import { reconFindingSchema, type ReconFinding } from "../../core/recon/finding.js";
import { reconPackSchema, reconUuidSchema } from "../../core/recon/record-types.js";

const reconEngineInputSchema = z.object({ caseId: reconUuidSchema, pack: reconPackSchema, records: z.array(z.unknown()).min(1) }).strict();
export type ReconEngineInput = z.input<typeof reconEngineInputSchema>;

export const reconEngineResultSchema = z.object({
  caseId: reconUuidSchema,
  pack: reconPackSchema,
  workspaceId: z.string().min(1),
  recordIds: z.array(reconUuidSchema).min(1),
  status: z.enum(["clean", "excepted"]),
  findings: z.array(reconFindingSchema)
}).strict();
export type ReconEngineResult = z.infer<typeof reconEngineResultSchema>;

interface PackDefinition {
  readonly parse: (records: readonly unknown[]) => readonly { readonly recordId: string; readonly workspaceId: string }[];
  readonly checks: (records: readonly unknown[]) => ReconFinding[];
}

const definitions: Record<z.infer<typeof reconPackSchema>, PackDefinition> = {
  transport: { parse: (records) => transportRecordSchema.array().parse(records), checks: transportDefaultChecks },
  billing: { parse: (records) => billingRecordSchema.array().parse(records), checks: billingDefaultChecks }
};

/** Run one generic reconciliation case through the selected deterministic pack checks. */
export function runReconCase(input: unknown): ReconEngineResult {
  const parsed = reconEngineInputSchema.parse(input);
  const definition = definitions[parsed.pack];
  const records = definition.parse(parsed.records);
  const workspaceIds = new Set(records.map((record) => record.workspaceId));
  if (workspaceIds.size !== 1) throw new Error("reconciliation case must contain one workspace");
  const findings = definition.checks(parsed.records).sort((left, right) => left.code.localeCompare(right.code));
  return reconEngineResultSchema.parse({ caseId: parsed.caseId, pack: parsed.pack, workspaceId: records[0].workspaceId, recordIds: records.map((record) => record.recordId), status: findings.length === 0 ? "clean" : "excepted", findings });
}
