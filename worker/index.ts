import { randomUUID } from "node:crypto";
import { InMemoryWorkerRepository, WorkerCoordinator, neutralEchoHandler, makeJob } from "../src/server/worker.js";

const args = new Set(process.argv.slice(2));
if (!args.has("--dry-run")) throw new Error("worker requires --dry-run in prebuild");
const repository = new InMemoryWorkerRepository();
const clock = { now: () => new Date("2026-10-06T00:00:00.000Z") };
const coordinator = new WorkerCoordinator(repository, clock, neutralEchoHandler, { leaseMs: 30_000 });
const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.once("SIGINT", stop); process.once("SIGTERM", stop);
const job = makeJob("550e8400-e29b-41d4-a716-446655440099", "dry_run", `dry-run-${randomUUID()}`, { marker: "neutral" });
await repository.enqueue(job);
console.log(JSON.stringify({ mode: "dry-run", storage: "in-memory", durableMongo: false, handler: "neutral-echo", once: args.has("--once") }, null, 2));
const result = await coordinator.processOnce("dry_run", "worker-dry-run", shutdown.signal);
console.log(JSON.stringify({ result, checkpoint: repository.jobs.get(job.id)?.checkpoint, status: repository.jobs.get(job.id)?.status }, null, 2));
if (!args.has("--once")) while (!shutdown.signal.aborted) { await new Promise((resolve) => setTimeout(resolve, 1_000)); }
process.removeListener("SIGINT", stop); process.removeListener("SIGTERM", stop);
