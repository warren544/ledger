import "../src/lib/load-env.js";
import { randomUUID } from "node:crypto";
import { neutralSelfTestImplementation, runEvaluation } from "../src/server/eval-runner.js";

const now = { now: () => new Date("2026-10-06T00:00:00.000Z") };
const result = await runEvaluation({ runId: randomUUID(), runnerId: "eval-cli", implementation: neutralSelfTestImplementation, clock: now });
console.log(JSON.stringify({ mode: result.report.mode, implementationId: result.report.implementationId, counts: result.report.counts, datasetHash: result.report.datasetHash }, null, 2));
