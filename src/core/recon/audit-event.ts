import { z } from "zod";
import { reconHashSchema, reconTimestampSchema, reconUuidSchema, reconWorkspaceIdSchema } from "./record-types.js";

export const RECON_AUDIT_EVENT_VERSION = 1 as const;

export const reconAuditEventSchema = z.object({
  version: z.literal(RECON_AUDIT_EVENT_VERSION),
  index: z.number().int().nonnegative(),
  type: z.string().regex(/^[a-z][a-z0-9._-]{1,99}$/),
  actorId: reconUuidSchema,
  subjectId: reconUuidSchema,
  workspaceId: reconWorkspaceIdSchema,
  createdAt: reconTimestampSchema,
  previousHash: reconHashSchema,
  payloadHash: reconHashSchema,
  hash: reconHashSchema
}).strict();
export type ReconAuditEvent = z.infer<typeof reconAuditEventSchema>;
