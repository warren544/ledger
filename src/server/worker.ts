import { randomUUID } from "node:crypto";
import { genericJobSchema, DEFAULT_RETRY_POLICY, type GenericJob, type JobCheckpoint, type RetryPolicy, type WorkerClock, type WorkerRepository } from "../core/worker-types.js";
import type { JsonValue } from "../core/types.js";
export { DEFAULT_RETRY_POLICY, genericJobSchema, WORKER_JOB_SCHEMA_VERSION, type GenericJob, type JobCheckpoint, type JobClaim, type RetryPolicy, type WorkerClock, type WorkerRepository } from "../core/worker-types.js";
import type { JobClaim } from "../core/worker-types.js";

function validatePolicy(policy: RetryPolicy): RetryPolicy {
  if (!Number.isSafeInteger(policy.maxAttempts) || policy.maxAttempts < 1 || !Number.isSafeInteger(policy.baseDelayMs) || policy.baseDelayMs < 0 || !Number.isSafeInteger(policy.maxDelayMs) || policy.maxDelayMs < policy.baseDelayMs) throw new RangeError("invalid worker retry policy");
  return policy;
}
function iso(date: Date): string { return date.toISOString(); }
function safeMessage(error: unknown): string { return error instanceof Error ? error.message.slice(0, 500) : "handler failed"; }

export interface WorkerHandler { handle(job: GenericJob, signal: AbortSignal): Promise<{ readonly checkpoint?: JobCheckpoint }>; }
export const neutralEchoHandler: WorkerHandler = { async handle(job) { return { checkpoint: { marker: "neutral-echo-ack", jobId: job.id, kind: job.kind } }; } };

export class WorkerCoordinator {
  constructor(private readonly repository: WorkerRepository, private readonly clock: WorkerClock, private readonly handler: WorkerHandler, private readonly options: { readonly leaseMs: number; readonly retryPolicy?: RetryPolicy }) {
    if (!Number.isSafeInteger(options.leaseMs) || options.leaseMs < 1) throw new RangeError("leaseMs must be a positive safe integer");
    validatePolicy(options.retryPolicy ?? DEFAULT_RETRY_POLICY);
  }
  async processOnce(workspaceId: string, workerId: string, signal = new AbortController().signal): Promise<"idle" | "succeeded" | "failed" | "terminal"> {
    const claim = await this.repository.claim(workspaceId, workerId, this.clock.now(), this.options.leaseMs);
    if (!claim) return "idle";
    try {
      const result = await this.handler.handle(claim.job, signal);
      if (!await this.repository.acknowledgeSuccess(claim, this.clock.now(), result.checkpoint)) throw new Error("stale worker cannot acknowledge success");
      return "succeeded";
    } catch (error) {
      const outcome = await this.repository.acknowledgeFailure(claim, this.clock.now(), safeMessage(error), this.options.retryPolicy ?? DEFAULT_RETRY_POLICY);
      if (!outcome.acknowledged) throw new Error("stale worker cannot acknowledge failure");
      return outcome.terminal ? "terminal" : "failed";
    }
  }
}

export class InMemoryWorkerRepository implements WorkerRepository {
  readonly jobs = new Map<string, GenericJob>();
  async enqueue(job: GenericJob): Promise<GenericJob> {
    const duplicate = [...this.jobs.values()].find((item) => item.workspaceId === job.workspaceId && item.dedupeKey === job.dedupeKey);
    if (duplicate) return duplicate;
    const validated = genericJobSchema.parse(structuredClone(job)); this.jobs.set(validated.id, validated); return validated;
  }
  async claim(workspaceId: string, workerId: string, now: Date, leaseMs: number): Promise<JobClaim | null> {
    const candidate = [...this.jobs.values()].filter((job) => job.workspaceId === workspaceId && (job.status === "queued" || (job.status === "leased" && job.leaseExpiresAt !== undefined && Date.parse(job.leaseExpiresAt) <= now.getTime())) && Date.parse(job.availableAt) <= now.getTime()).sort((a, b) => Date.parse(a.availableAt) - Date.parse(b.availableAt))[0];
    if (!candidate) return null;
    const fencingToken = randomUUID(); const updated: GenericJob = { ...candidate, status: "leased", attempts: candidate.attempts + 1, leaseOwner: workerId, fencingToken, leaseExpiresAt: iso(new Date(now.getTime() + leaseMs)) };
    this.jobs.set(candidate.id, updated); return { job: updated, workerId, fencingToken };
  }
  private owns(claim: JobClaim): GenericJob | null { const job = this.jobs.get(claim.job.id); return job?.status === "leased" && job.leaseOwner === claim.workerId && job.fencingToken === claim.fencingToken ? job : null; }
  async renewLease(claim: JobClaim, now: Date, leaseMs: number): Promise<boolean> { const job = this.owns(claim); if (!job) return false; this.jobs.set(job.id, { ...job, leaseExpiresAt: iso(new Date(now.getTime() + leaseMs)) }); return true; }
  async acknowledgeSuccess(claim: JobClaim, _now: Date, checkpoint?: JobCheckpoint): Promise<boolean> { const job = this.owns(claim); if (!job) return false; this.jobs.set(job.id, { ...job, status: "succeeded", checkpoint, leaseOwner: undefined, fencingToken: undefined, leaseExpiresAt: undefined }); return true; }
  async acknowledgeFailure(claim: JobClaim, now: Date, message: string, policy: RetryPolicy): Promise<{ acknowledged: boolean; terminal: boolean }> { const job = this.owns(claim); if (!job) return { acknowledged: false, terminal: false }; const terminal = job.attempts >= validatePolicy(policy).maxAttempts; const delay = Math.min(policy.maxDelayMs, policy.baseDelayMs * (2 ** Math.max(0, job.attempts - 1))); this.jobs.set(job.id, { ...job, status: terminal ? "failed" : "queued", availableAt: iso(new Date(now.getTime() + delay)), lastError: message.slice(0, 500), leaseOwner: undefined, fencingToken: undefined, leaseExpiresAt: undefined }); return { acknowledged: true, terminal }; }
  async saveCheckpoint(claim: JobClaim, _now: Date, checkpoint: JobCheckpoint): Promise<boolean> { const job = this.owns(claim); if (!job) return false; this.jobs.set(job.id, { ...job, checkpoint }); return true; }
}

export function makeJob(id: string, workspaceId: string, dedupeKey: string, payload: JsonValue, availableAt = new Date("2026-10-06T00:00:00.000Z")): GenericJob { return genericJobSchema.parse({ version: 1, id, workspaceId, kind: "neutral.echo", payload, dedupeKey, status: "queued", attempts: 0, availableAt: availableAt.toISOString() }); }
