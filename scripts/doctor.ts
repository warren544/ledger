import { readEnv } from "../src/lib/env.js";

const env = readEnv();
console.log(JSON.stringify({
  ok: true,
  node: process.version,
  environment: env.nodeEnv,
  workspaceId: env.workspaceId,
  configured: {
    mongodb: env.mongodbUri !== undefined,
    openai: env.openaiApiKey !== undefined
  },
  connectivity: {
    mongodb: "not_checked",
    openai: "not_checked"
  }
}, null, 2));
