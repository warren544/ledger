import { z } from "zod";
import { jsonValueSchema, type JsonValue } from "./types.js";

export const WORKER_JOB_SCHEMA_VERSION = 1 as const;
export const DEFAULT_RETRY_POLICY = { maxAttempts: 3, baseDelayMs: 5_000, maxDelayMs: 60_000 } as const;
const timestamp = z.string().datetime({ offset: true });
export const genericJobSchema = z.object({ version: z.literal(WORKER_JOB_SCHEMA_VERSION), id: z.string().uuid(), workspaceId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/), kind: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/), payload: jsonValueSchema, dedupeKey: z.string().min(1).max(200), status: z.enum(["queued", "leased", "succeeded", "failed"]), attempts: z.number().int().nonnegative(), availableAt: timestamp, leaseOwner: z.string().min(1).optional(), fencingToken: z.string().uuid().optional(), leaseExpiresAt: timestamp.optional(), checkpoint: jsonValueSchema.optional(), lastError: z.string().max(500).optional() }).strict();
export type GenericJob = z.infer<typeof genericJobSchema>;
export type JobCheckpoint = JsonValue;
export interface JobClaim { readonly job: GenericJob; readonly workerId: string; readonly fencingToken: string; }
export interface RetryPolicy { readonly maxAttempts: number; readonly baseDelayMs: number; readonly maxDelayMs: number; }
export interface WorkerClock { now(): Date; }
export interface WorkerRepository { enqueue(job: GenericJob): Promise<GenericJob>; claim(workspaceId: string, workerId: string, now: Date, leaseMs: number): Promise<JobClaim | null>; renewLease(claim: JobClaim, now: Date, leaseMs: number): Promise<boolean>; acknowledgeSuccess(claim: JobClaim, now: Date, checkpoint?: JobCheckpoint): Promise<boolean>; acknowledgeFailure(claim: JobClaim, now: Date, message: string, policy: RetryPolicy): Promise<{ acknowledged: boolean; terminal: boolean }>; saveCheckpoint(claim: JobClaim, now: Date, checkpoint: JobCheckpoint): Promise<boolean>; }
