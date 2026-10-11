import { connectMongo } from "../../adapters/mongo/index.js";
import { createOpenAIClient } from "../../adapters/llm/index.js";
import { readEnv } from "../../lib/env.js";
import { readReconMongoConfig } from "../mongo.js";
import { createReconRepository } from "./repository.js";
import { createReconService } from "./service.js";
import { createRuleService } from "./approval.js";
import { createLlmRuleProposalGenerator } from "./approval.js";
import { createRaindropClient, warnRaindropTelemetryFailure, type RaindropTelemetryClient } from "../adapters/raindrop.js";
import { redact } from "../../core/redaction.js";

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
  const apiKey = env.openaiApiKey;
  return { client: createOpenAIClient({ apiKey, model: "gpt-5-mini", timeoutMs: 10_000, maxRetries: 1 }), apiKey, logError: ({ error, caseId, exceptionId }) => console.error(JSON.stringify({ event: "exception_draft_openai_failure", caseId, exceptionId, error: redact({ name: error instanceof Error ? error.name : "unknown", message: error instanceof Error ? error.message : String(error), code: error && typeof error === "object" && "code" in error ? (error as { code?: unknown }).code : undefined }, { secrets: [apiKey] }) })) };
}

export function createReconRuleProposalGenerator(): import("./approval.js").RuleProposalGenerator {
  const env = readEnv();
  if (!env.openaiApiKey) throw new Error("OPENAI_API_KEY is required for rule proposals");
  let telemetry: RaindropTelemetryClient | undefined;
  try { telemetry = createRaindropClient(); } catch (error) { warnRaindropTelemetryFailure("create", error); }
  return createLlmRuleProposalGenerator(createOpenAIClient({ apiKey: env.openaiApiKey, model: "gpt-5-mini", timeoutMs: 10_000, maxRetries: 1 }), env.openaiApiKey, telemetry);
}

export async function withConnectedRuleService<T>(work: (service: ReturnType<typeof createRuleService>) => Promise<T>): Promise<T> {
  const config = readReconMongoConfig();
  const client = await connectMongo(config);
  try { return await work(createRuleService(createReconRepository(client.db(config.database)))); }
  finally { await client.close(); }
}
