import { connectMongo } from "../../adapters/mongo/index.js";
import { createOpenAIClient } from "../../adapters/llm/index.js";
import { readEnv } from "../../lib/env.js";
import { readReconMongoConfig } from "../mongo.js";
import { createReconRepository } from "./repository.js";
import { createReconService } from "./service.js";
import { createRuleService } from "./approval.js";
import { createLlmRuleProposalGenerator } from "./approval.js";
import { createRaindropClient } from "../adapters/raindrop.js";

/** Server-only route seam; app handlers never import the Mongo adapter directly. */
export async function withConnectedReconService<T>(work: (service: ReturnType<typeof createReconService>) => Promise<T>): Promise<T> {
  const config = readReconMongoConfig();
  const client = await connectMongo(config);
  try { return await work(createReconService(createReconRepository(client.db(config.database)))); }
  finally { await client.close(); }
}

export function createReconDraftDependencies(): import("./drafter.js").DraftDependencies {
  const env = readEnv();
  if (!env.openaiApiKey) throw new Error("OPENAI_API_KEY is required for exception drafting");
  return { client: createOpenAIClient({ apiKey: env.openaiApiKey, model: "gpt-5-mini", timeoutMs: 10_000, maxRetries: 1 }), apiKey: env.openaiApiKey };
}

export function createReconRuleProposalGenerator(): import("./approval.js").RuleProposalGenerator {
  const env = readEnv();
  if (!env.openaiApiKey) throw new Error("OPENAI_API_KEY is required for rule proposals");
  return createLlmRuleProposalGenerator(createOpenAIClient({ apiKey: env.openaiApiKey, model: "gpt-5-mini", timeoutMs: 10_000, maxRetries: 1 }), env.openaiApiKey, createRaindropClient());
}

export async function withConnectedRuleService<T>(work: (service: ReturnType<typeof createRuleService>) => Promise<T>): Promise<T> {
  const config = readReconMongoConfig();
  const client = await connectMongo(config);
  try { return await work(createRuleService(createReconRepository(client.db(config.database)))); }
  finally { await client.close(); }
}
