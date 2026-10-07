import { z } from "zod";

export const evalCaseSchema = z.object({ caseId: z.string().uuid(), status: z.enum(["ok", "error"]), error: z.string().max(500).nullable() }).strict();
export const evalReportSchema = z.object({
  version: z.literal(1), runId: z.string().uuid(), datasetId: z.string().min(1), datasetHash: z.string().regex(/^[a-f0-9]{64}$/),
  runnerId: z.string().min(1), implementationId: z.string().min(1), mode: z.literal("prebuild-plumbing"), source: z.literal("fixture"),
  startedAt: z.string().datetime({ offset: true }), finishedAt: z.string().datetime({ offset: true }),
  counts: z.object({ total: z.number().int().nonnegative(), ok: z.number().int().nonnegative(), error: z.number().int().nonnegative() }).strict(),
  cases: z.array(evalCaseSchema),
  domainMetrics: z.object({ duplicateAccuracy: z.null(), splitAccuracy: z.null(), precision: z.null(), recall: z.null() }).strict()
}).strict();
export type EvalCase = z.infer<typeof evalCaseSchema>;
export type EvalReport = z.infer<typeof evalReportSchema>;
