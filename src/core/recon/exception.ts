import { z } from "zod";
import { reconCaseSchema, reconTimestampSchema, reconUuidSchema, reconWorkspaceIdSchema, evidenceSchema } from "./record-types.js";
import { varianceResultSchema } from "./variance.js";

export const exceptionSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export type ExceptionSeverity = z.infer<typeof exceptionSeveritySchema>;

export const exceptionStateSchema = z.enum(["open", "drafted", "needs_human", "corrected", "accepted", "escalated", "resolved"]);
export type ExceptionState = z.infer<typeof exceptionStateSchema>;

export const exceptionSchema = z.object({
  exceptionId: reconUuidSchema,
  workspaceId: reconWorkspaceIdSchema,
  caseId: reconCaseSchema.shape.caseId,
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/),
  severity: exceptionSeveritySchema,
  state: exceptionStateSchema,
  evidence: z.array(evidenceSchema),
  variance: varianceResultSchema.nullable(),
  createdAt: reconTimestampSchema,
  updatedAt: reconTimestampSchema
}).strict();
export type ReconException = z.infer<typeof exceptionSchema>;

const transitions: Record<ExceptionState, readonly ExceptionState[]> = {
  open: ["drafted", "needs_human"],
  drafted: ["needs_human", "corrected", "accepted", "escalated"],
  needs_human: ["corrected", "accepted", "escalated"],
  corrected: ["resolved"],
  accepted: ["resolved"],
  escalated: ["resolved"],
  resolved: []
};

/** Apply only an explicitly allowed exception state transition. */
export function transitionException(input: ReconException, nextState: ExceptionState, updatedAt: string): ReconException {
  const current = exceptionSchema.parse(input);
  reconTimestampSchema.parse(updatedAt);
  if (!transitions[current.state].includes(nextState)) throw new Error(`invalid exception transition: ${current.state} -> ${nextState}`);
  return exceptionSchema.parse({ ...current, state: nextState, updatedAt });
}
