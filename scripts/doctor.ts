import { readEnv } from "../src/lib/env.js";

const env = readEnv();
console.log(JSON.stringify({ ok: true, node: process.version, environment: env.nodeEnv, workspaceId: env.workspaceId }, null, 2));
