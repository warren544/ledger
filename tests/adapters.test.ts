import test from "node:test";
import assert from "node:assert/strict";
import { createEmbedding, EMBEDDING_DIMENSIONS } from "../src/adapters/embeddings/index.js";
import { requestNeutralMessage } from "../src/adapters/llm/index.js";
import { NeutralEmbeddingStore, type MongoClientLike, type MongoCollectionLike, type MongoDatabaseLike } from "../src/adapters/mongo/index.js";
import { runAdaptersSmoke } from "../src/server/adapters.js";

const secret = "dummy-openai-secret";
const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, index) => index === 0 ? 1 : 0);

test("validates a neutral structured response and passes bounded request options", async () => {
  let request: unknown;
  const client = { responses: { parse: async (body: unknown, options: unknown) => { request = { body, options }; return { output_parsed: { message: "ok" } }; } } };
  assert.deepEqual(await requestNeutralMessage(client, { apiKey: secret, timeoutMs: 1234, maxRetries: 0 }), { message: "ok" });
  assert.equal((request as { options: { timeout: number; maxRetries: number } }).options.timeout, 1234);
  assert.equal((request as { options: { timeout: number; maxRetries: number } }).options.maxRetries, 0);
});

test("rejects malformed structured output and retries only within the bound", async () => {
  let calls = 0;
  const client = { responses: { parse: async () => { calls += 1; return { output_parsed: { message: 7 } }; } } };
  await assert.rejects(() => requestNeutralMessage(client, { apiKey: secret, maxRetries: 1 }), /OpenAI operation failed/);
  assert.equal(calls, 2);
});

test("aborts structured requests without retrying", async () => {
  const controller = new AbortController(); controller.abort(); let calls = 0;
  const client = { responses: { parse: async () => { calls += 1; return { output_parsed: { message: "never" } }; } } };
  await assert.rejects(() => requestNeutralMessage(client, { apiKey: secret, signal: controller.signal }), /aborted/);
  assert.equal(calls, 0);
});

test("accepts exactly 1536 finite embedding values", async () => {
  const client = { embeddings: { create: async () => ({ data: [{ embedding: vector }] }) } };
  assert.equal((await createEmbedding(client, { apiKey: secret }, "neutral sample")).length, EMBEDDING_DIMENSIONS);
});

test("rejects embedding dimension and finite-value violations", async () => {
  const short = { embeddings: { create: async () => ({ data: [{ embedding: [1, 2] }] }) } };
  await assert.rejects(() => createEmbedding(short, { apiKey: secret }, "neutral"), /invalid dimensions/);
  const nonFinite = { embeddings: { create: async () => ({ data: [{ embedding: [...vector.slice(0, -1), Number.NaN] }] }) } };
  await assert.rejects(() => createEmbedding(nonFinite, { apiKey: secret, maxRetries: 0 }, "neutral"), /invalid dimensions/);
});

class EmbeddingCollection implements MongoCollectionLike {
  readonly docs: Array<Record<string, unknown>> = [];
  readonly deleted: Array<Record<string, unknown>> = [];
  async findOne(): Promise<unknown> { return null; }
  async replaceOne(_filter: Readonly<Record<string, unknown>>, replacement: unknown): Promise<void> { this.docs.push(replacement as Record<string, unknown>); }
  async deleteOne(filter: { readonly workspaceId: string; readonly id?: string; readonly recordId?: string }): Promise<void> { this.deleted.push(filter); }
  async createIndex(): Promise<string> { return "index"; }
  async createSearchIndex(): Promise<string> { return "vector"; }
  listSearchIndexes(): { toArray(): Promise<readonly unknown[]> } { return { toArray: async () => [{ name: "synthetic_embeddings_vector", queryable: true }] }; }
  aggregate(pipeline: readonly unknown[]): { toArray(): Promise<readonly unknown[]> } {
    const stage = pipeline[0] as { $vectorSearch: { index: string; path: string; filter: { workspaceId: string }; queryVector: readonly number[] } };
    assert.equal(stage.$vectorSearch.index, "synthetic_embeddings_vector");
    assert.equal(stage.$vectorSearch.path, "embedding");
    assert.equal(stage.$vectorSearch.queryVector.length, EMBEDDING_DIMENSIONS);
    return { toArray: async () => this.docs.filter((doc) => doc.workspaceId === stage.$vectorSearch.filter.workspaceId) };
  }
}
class EmbeddingDatabase implements MongoDatabaseLike {
  readonly collectionValue = new EmbeddingCollection();
  collection(_name: string): EmbeddingCollection { return this.collectionValue; }
  async createCollection(): Promise<void> { return; }
  async command(): Promise<void> { return; }
  listCollections(): { toArray(): Promise<Array<{ name: string }>> } { return { toArray: async () => [] }; }
}
class EmbeddingClient implements MongoClientLike {
  readonly database = new EmbeddingDatabase(); closed = false;
  async connect(): Promise<void> { return; }
  async close(): Promise<void> { this.closed = true; }
  db(_name: string): EmbeddingDatabase { return this.database; }
}

test("waits for readiness, applies workspace filter, and cleans up only its record", async () => {
  const client = new EmbeddingClient(); const store = new NeutralEmbeddingStore(client, "test", "neutral");
  await store.waitForReady("synthetic_embeddings_vector", 100);
  await store.upsert({ recordId: "550e8400-e29b-41d4-a716-446655440000", workspaceId: "workspace_a", embedding: vector });
  assert.equal(((await store.nearest("workspace_a", vector))[0] as { workspaceId: string }).workspaceId, "workspace_a");
  assert.deepEqual(await store.nearest("workspace_b", vector), []);
  await store.delete("550e8400-e29b-41d4-a716-446655440000", "workspace_a");
  assert.deepEqual(client.database.collectionValue.deleted, [{ recordId: "550e8400-e29b-41d4-a716-446655440000", workspaceId: "workspace_a" }]);
  await store.close(); assert.equal(client.closed, true);
});

test("smoke gate rejects non-live and missing cost confirmation before creating clients", async () => {
  await assert.rejects(() => runAdaptersSmoke({ MONGODB_URI: "mongodb://dummy.example.test", MONGODB_TEST_DATABASE: "test", MONGODB_TEST_NAMESPACE: "neutral", OPENAI_API_KEY: secret }, false, true), /--live/);
  await assert.rejects(() => runAdaptersSmoke({ MONGODB_URI: "mongodb://dummy.example.test", MONGODB_TEST_DATABASE: "test", MONGODB_TEST_NAMESPACE: "neutral", OPENAI_API_KEY: secret }, true, false), /--confirm-api-cost/);
});

test("adapter failures do not disclose the API key", async () => {
  const client = { responses: { parse: async () => { throw new Error(`failure ${secret}`); } } };
  await assert.rejects(() => requestNeutralMessage(client, { apiKey: secret, maxRetries: 0 }), (error: Error) => !error.message.includes(secret));
});
