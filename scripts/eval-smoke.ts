import "../src/lib/load-env.js";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { neutralSelfTestImplementation, runEvaluation } from "../src/server/eval-runner.js";

const result = await runEvaluation({ runId: randomUUID(), runnerId: "eval-smoke-cli", implementation: neutralSelfTestImplementation, clock: { now: () => new Date() }, outputDir: fileURLToPath(new URL("../evals/reports", import.meta.url)) });
console.log(JSON.stringify({ outputPath: result.outputPath, report: result.report }, null, 2));
