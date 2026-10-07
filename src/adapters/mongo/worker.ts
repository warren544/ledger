import { randomUUID } from "node:crypto";
import { redact } from "../../core/redaction.js";
import { genericJobSchema, type GenericJob, type JobClaim, type JobCheckpoint, type RetryPolicy, type WorkerRepository } from "../../core/worker-types.js";
import type { MongoClientLike } from "./index.js";

export const WORKER_JOBS_SUFFIX = "_worker_jobs";
export const WORKER_JOBS_INDEX = "worker_jobs_workspace_dedupe_unique";
export function workerJobCollectionName(namespace: string): string { if (!/^[a-z][a-z0-9_]{0,30}$/.test(namespace)) throw new Error("invalid worker namespace"); return `${namespace}${WORKER_JOBS_SUFFIX}`; }
export const workerJobValidator = { $jsonSchema: { bsonType: "object", additionalProperties: false, required: ["version", "id", "workspaceId", "kind", "payload", "dedupeKey", "status", "attempts", "availableAt"], properties: { _id: { bsonType: "objectId" }, version: { bsonType: "int", enum: [1] }, id: { bsonType: "string" }, workspaceId: { bsonType: "string" }, kind: { bsonType: "string" }, payload: {}, dedupeKey: { bsonType: "string" }, status: { enum: ["queued", "leased", "succeeded", "failed"] }, attempts: { bsonType: "int" }, availableAt: { bsonType: "date" }, leaseOwner: { bsonType: "string" }, fencingToken: { bsonType: "string" }, leaseExpiresAt: { bsonType: "date" }, checkpoint: {}, lastError: { bsonType: "string" } } } } as const;

interface MongoJobCollection {
  insertOne(document: GenericJob): Promise<unknown>;
  findOne(filter: Readonly<Record<string, unknown>>): Promise<unknown>;
  findOneAndUpdate(filter: Readonly<Record<string, unknown>>, update: Readonly<Record<string, unknown>>, options: Readonly<Record<string, unknown>>): Promise<unknown>;
  updateOne(filter: Readonly<Record<string, unknown>>, update: Readonly<Record<string, unknown>>): Promise<{ readonly matchedCount: number }>;
  createIndex(keys: Readonly<Record<string, 1 | -1>>, options?: Readonly<Record<string, unknown>>): Promise<string>;
}

function errorMessage(error: unknown): string { return JSON.stringify(redact(error)); }
function toJob(value: unknown): GenericJob { const input = { ...(value as Record<string, unknown>) }; if (input.availableAt instanceof Date) input.availableAt = input.availableAt.toISOString(); if (input.leaseExpiresAt instanceof Date) input.leaseExpiresAt = input.leaseExpiresAt.toISOString(); return genericJobSchema.parse(input); }
function mongoDates(job: GenericJob): Record<string, unknown> { const result: Record<string, unknown> = { ...job, availableAt: new Date(job.availableAt) }; if (job.leaseExpiresAt) result.leaseExpiresAt = new Date(job.leaseExpiresAt); return result; }

export class MongoWorkerRepository implements WorkerRepository {
  private readonly jobs: MongoJobCollection;
  constructor(private readonly client: MongoClientLike, database: string, namespace: string) { this.jobs = client.db(database).collection(workerJobCollectionName(namespace)) as unknown as MongoJobCollection; }
  async ensureIndexes(): Promise<string> { return this.jobs.createIndex({ workspaceId: 1, dedupeKey: 1 }, { name: WORKER_JOBS_INDEX, unique: true }); }
  async enqueue(job: GenericJob): Promise<GenericJob> { const validated = toJob(job); try { await this.jobs.insertOne(mongoDates(validated) as unknown as GenericJob); return validated; } catch (error) { if ((error as { code?: number }).code !== 11000) throw new Error(`Mongo worker enqueue failed: ${errorMessage(error)}`); const existing = await this.jobs.findOne({ workspaceId: validated.workspaceId, dedupeKey: validated.dedupeKey }); if (!existing) throw new Error("Mongo worker dedupe lookup failed"); return toJob(existing); } }
  async claim(workspaceId: string, workerId: string, now: Date, leaseMs: number): Promise<JobClaim | null> { const fencingToken = randomUUID(); const expires = new Date(now.getTime() + leaseMs); const result = await this.jobs.findOneAndUpdate({ workspaceId, availableAt: { $lte: now }, $or: [{ status: "queued" }, { status: "leased", leaseExpiresAt: { $lte: now } }] }, { $set: { status: "leased", leaseOwner: workerId, fencingToken, leaseExpiresAt: expires }, $inc: { attempts: 1 } }, { sort: { availableAt: 1 }, returnDocument: "after" }); if (!result) return null; const job = toJob(result); return { job, workerId, fencingToken }; }
  private leaseFilter(claim: JobClaim): Record<string, unknown> { return { workspaceId: claim.job.workspaceId, id: claim.job.id, status: "leased", leaseOwner: claim.workerId, fencingToken: claim.fencingToken }; }
  async renewLease(claim: JobClaim, now: Date, leaseMs: number): Promise<boolean> { const result = await this.jobs.updateOne(this.leaseFilter(claim), { $set: { leaseExpiresAt: new Date(now.getTime() + leaseMs) } }); return result.matchedCount === 1; }
  async acknowledgeSuccess(claim: JobClaim, _now: Date, checkpoint?: JobCheckpoint): Promise<boolean> { const set: Record<string, unknown> = { status: "succeeded", leaseOwner: null, fencingToken: null, leaseExpiresAt: null }; if (checkpoint !== undefined) set.checkpoint = checkpoint; const result = await this.jobs.updateOne(this.leaseFilter(claim), { $set: set }); return result.matchedCount === 1; }
  async acknowledgeFailure(claim: JobClaim, now: Date, message: string, policy: RetryPolicy): Promise<{ acknowledged: boolean; terminal: boolean }> { const attempts = claim.job.attempts; const terminal = attempts >= policy.maxAttempts; const delay = Math.min(policy.maxDelayMs, policy.baseDelayMs * (2 ** Math.max(0, attempts - 1))); const result = await this.jobs.updateOne(this.leaseFilter(claim), { $set: { status: terminal ? "failed" : "queued", availableAt: new Date(now.getTime() + delay), lastError: message.slice(0, 500), leaseOwner: null, fencingToken: null, leaseExpiresAt: null } }); return { acknowledged: result.matchedCount === 1, terminal }; }
  async saveCheckpoint(claim: JobClaim, _now: Date, checkpoint: JobCheckpoint): Promise<boolean> { const result = await this.jobs.updateOne(this.leaseFilter(claim), { $set: { checkpoint } }); return result.matchedCount === 1; }
  async close(): Promise<void> { await this.client.close(); }
}
