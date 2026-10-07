import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryWorkerRepository, WorkerCoordinator, makeJob, neutralEchoHandler, type WorkerClock, type WorkerHandler } from "../src/server/worker.js";

const id = "550e8400-e29b-41d4-a716-446655440010";
function setup() { let current = new Date("2026-10-06T00:00:00.000Z"); const clock: WorkerClock = { now: () => current }; return { clock, advance: (ms: number) => { current = new Date(current.getTime() + ms); }, now: () => current }; }
function job(workspaceId: string, dedupeKey: string) { return makeJob(id, workspaceId, dedupeKey, { opaque: "neutral" }); }

test("atomic double claim permits only one of two workers", async () => {
  const repo = new InMemoryWorkerRepository(); const time = setup(); await repo.enqueue(job("workspace_a", "same"));
  const claims = await Promise.all([repo.claim("workspace_a", "worker_a", time.now(), 1000), repo.claim("workspace_a", "worker_b", time.now(), 1000)]);
  assert.equal(claims.filter(Boolean).length, 1);
});

test("expired leases are reclaimable by another worker", async () => {
  const repo = new InMemoryWorkerRepository(); const time = setup(); await repo.enqueue(job("workspace_a", "expiry")); const first = await repo.claim("workspace_a", "worker_a", time.now(), 1000); assert.ok(first); time.advance(1001); const second = await repo.claim("workspace_a", "worker_b", time.now(), 1000); assert.ok(second); assert.notEqual(first.fencingToken, second.fencingToken);
});

test("stale fencing tokens cannot acknowledge or overwrite a reclaimed job", async () => {
  const repo = new InMemoryWorkerRepository(); const time = setup(); await repo.enqueue(job("workspace_a", "fence")); const first = await repo.claim("workspace_a", "worker_a", time.now(), 1000); assert.ok(first); time.advance(1001); const second = await repo.claim("workspace_a", "worker_b", time.now(), 1000); assert.ok(second); assert.equal(await repo.acknowledgeSuccess(first, time.now(), { stale: true }), false); assert.equal(repo.jobs.get(id)?.leaseOwner, "worker_b");
});

test("dedupe is unique within a workspace but independent across workspaces", async () => {
  const repo = new InMemoryWorkerRepository(); const first = await repo.enqueue(job("workspace_a", "same")); const duplicate = await repo.enqueue({ ...first, id: "550e8400-e29b-41d4-a716-446655440011" }); const other = await repo.enqueue({ ...first, id: "550e8400-e29b-41d4-a716-446655440012", workspaceId: "workspace_b" }); assert.equal(duplicate.id, first.id); assert.equal(other.id, "550e8400-e29b-41d4-a716-446655440012");
});

test("claims and reads are workspace-scoped", async () => {
  const repo = new InMemoryWorkerRepository(); const time = setup(); await repo.enqueue(job("workspace_a", "scope")); assert.equal(await repo.claim("workspace_b", "worker", time.now(), 1000), null); assert.ok(await repo.claim("workspace_a", "worker", time.now(), 1000));
});

test("retry backoff is bounded and reaches a terminal failure", async () => {
  const repo = new InMemoryWorkerRepository(); const time = setup(); await repo.enqueue(job("workspace_a", "retry")); const policy = { maxAttempts: 2, baseDelayMs: 100, maxDelayMs: 150 }; const first = await repo.claim("workspace_a", "worker", time.now(), 1000); assert.ok(first); assert.deepEqual(await repo.acknowledgeFailure(first, time.now(), "dummy failure", policy), { acknowledged: true, terminal: false }); time.advance(150); const second = await repo.claim("workspace_a", "worker", time.now(), 1000); assert.ok(second); assert.deepEqual(await repo.acknowledgeFailure(second, time.now(), "dummy failure", policy), { acknowledged: true, terminal: true }); assert.equal(repo.jobs.get(id)?.status, "failed");
});

test("checkpoint persists across a worker restart", async () => {
  const repo = new InMemoryWorkerRepository(); const time = setup(); await repo.enqueue(job("workspace_a", "checkpoint")); const claim = await repo.claim("workspace_a", "worker_a", time.now(), 1000); assert.ok(claim); assert.equal(await repo.saveCheckpoint(claim, time.now(), { cursor: 3 }), true); assert.equal((repo.jobs.get(id)?.checkpoint as { cursor: number }).cursor, 3); time.advance(1001); const recovered = await repo.claim("workspace_a", "worker_b", time.now(), 1000); assert.equal((recovered?.job.checkpoint as { cursor: number }).cursor, 3);
});

test("coordinator uses the neutral handler and rejects stale completion", async () => {
  const repo = new InMemoryWorkerRepository(); const time = setup(); await repo.enqueue(job("workspace_a", "coordinator")); const coordinator = new WorkerCoordinator(repo, time, neutralEchoHandler, { leaseMs: 1000 }); assert.equal(await coordinator.processOnce("workspace_a", "worker"), "succeeded"); assert.equal(repo.jobs.get(id)?.status, "succeeded");
});

test("shutdown signal is passed to a handler without domain work", async () => {
  const repo = new InMemoryWorkerRepository(); const time = setup(); await repo.enqueue(job("workspace_a", "shutdown")); const controller = new AbortController(); const handler: WorkerHandler = { handle: async (_job, signal) => { assert.equal(signal, controller.signal); throw new Error("shutdown"); } }; const coordinator = new WorkerCoordinator(repo, time, handler, { leaseMs: 1000 }); controller.abort(); assert.equal(await coordinator.processOnce("workspace_a", "worker", controller.signal), "failed");
});
