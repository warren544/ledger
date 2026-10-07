import { randomUUID } from "node:crypto";
import { createEmbedding, createEmbeddingClient, DEFAULT_EMBEDDING_MODEL } from "../adapters/embeddings/index.js";
import { createOpenAIClient, DEFAULT_LLM_MODEL, requestNeutralMessage } from "../adapters/llm/index.js";
import { connectMongo, NeutralEmbeddingStore, VECTOR_INDEX_NAME, type MongoClientFactory } from "../adapters/mongo/index.js";
import { readEnv } from "../lib/env.js";
import { readMongoCliConfig } from "./mongo.js";
import { redact } from "../core/redaction.js";

export interface AdapterSmokeResult {
  readonly structuredModel: string;
  readonly structuredResponseShape: "object{message:string}";
  readonly embeddingModel: string;
  readonly embeddingResponseShape: "data[0].embedding:number[]";
  readonly embeddingDimension: 1536;
  readonly openAiCalls: 2;
  readonly vectorIndex: string;
  readonly vectorRoundTrip: { readonly insertedRecordId: string; readonly matchedRecordId: string; readonly workspaceFilter: string };
  readonly workspaceIsolation: "workspace-filtered";
  readonly cleanup: "deleted-own-record";
}

async function readBackVector(store: NeutralEmbeddingStore, workspaceId: string, vector: readonly number[], recordId: string, timeoutMs = 120_000, intervalMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() <= deadline) {
    try {
      const found = await store.nearest(workspaceId, vector, 1);
      if (found.some((item) => (item as { recordId?: string }).recordId === recordId)) return;
    } catch (error) {
      lastError = error;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
  }
  const query = { index: VECTOR_INDEX_NAME, filter: { workspaceId }, dimension: vector.length, recordId };
  throw new Error(`Atlas vector readback timed out after 120000ms: ${JSON.stringify(query)}${lastError ? "; query failed during polling" : "; record was not returned"}`);
}

export async function runAdaptersSmoke(input: Readonly<Record<string, string | undefined>>, live: boolean, confirmApiCost: boolean, mongoFactory?: MongoClientFactory): Promise<AdapterSmokeResult> {
  if (!live) throw new Error("adapter smoke requires --live");
  if (!confirmApiCost) throw new Error("OpenAI calls require --confirm-api-cost");
  const env = readEnv(input);
  if (!env.openaiApiKey) throw new Error("OPENAI_API_KEY is required for adapter smoke");
  const mongoConfig = readMongoCliConfig(input);
  const llmModel = input.OPENAI_LLM_MODEL ?? DEFAULT_LLM_MODEL;
  const embeddingModel = input.OPENAI_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  const llm = createOpenAIClient({ apiKey: env.openaiApiKey, model: llmModel, timeoutMs: mongoConfig.timeoutMs, maxRetries: 1 });
  const embeddingClient = createEmbeddingClient({ apiKey: env.openaiApiKey, model: embeddingModel, timeoutMs: mongoConfig.timeoutMs, maxRetries: 1 });
  try {
    const structured = await requestNeutralMessage(llm, { apiKey: env.openaiApiKey, model: llmModel, timeoutMs: mongoConfig.timeoutMs, maxRetries: 1 });
    if (typeof structured.message !== "string") throw new Error("structured response shape validation failed");
    const vector = await createEmbedding(embeddingClient, { apiKey: env.openaiApiKey, model: embeddingModel, timeoutMs: mongoConfig.timeoutMs, maxRetries: 1 }, "neutral adapter connectivity sample");
    const client = await connectMongo(mongoConfig, mongoFactory);
    const store = new NeutralEmbeddingStore(client, mongoConfig.database, mongoConfig.namespace);
    const recordId = randomUUID();
    const workspaceId = `adapter_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    try {
      await store.waitForReady(VECTOR_INDEX_NAME, mongoConfig.timeoutMs);
      await store.upsert({ recordId, workspaceId, embedding: vector });
      await readBackVector(store, workspaceId, vector, recordId);
      const otherWorkspace = await store.nearest("adapter_other_workspace", vector, 1);
      if (otherWorkspace.some((item) => (item as { recordId?: string }).recordId === recordId)) throw new Error("Atlas vector workspace filter failed");
      return { structuredModel: llmModel, structuredResponseShape: "object{message:string}", embeddingModel, embeddingResponseShape: "data[0].embedding:number[]", embeddingDimension: 1536, openAiCalls: 2, vectorIndex: VECTOR_INDEX_NAME, vectorRoundTrip: { insertedRecordId: recordId, matchedRecordId: recordId, workspaceFilter: workspaceId }, workspaceIsolation: "workspace-filtered", cleanup: "deleted-own-record" };
    } finally {
      try { await store.delete(recordId, workspaceId); } finally { await store.close(); }
    }
  } catch (error) {
    throw new Error(`adapter smoke failed: ${JSON.stringify(redact(error, { secrets: [env.openaiApiKey, mongoConfig.uri] }))}`);
  }
}
