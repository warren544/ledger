import test from "node:test";
import assert from "node:assert/strict";
import { collectionNames, connectMongo, createMongoClient, installNeutralMongoInfrastructure, NeutralRecordStore, neutralIndexDefinitions, neutralRecordValidator, redactedMongoError, type MongoClientLike, type MongoCollectionLike, type MongoDatabaseLike } from "../src/adapters/mongo/index.js";
import { readMongoCliConfig } from "../src/server/mongo.js";
import type { SyntheticRecord } from "../src/core/types.js";

const record: SyntheticRecord = { id: "550e8400-e29b-41d4-a716-446655440000", workspaceId: "demo", schemaVersion: 1, createdAt: "2026-10-06T00:00:00.000Z", kind: "email", customerId: "6ba7b810-9dad-41d1-80b4-00c04fd430c8", source: "synthetic", payload: { neutral: true } };

class FakeCollection implements MongoCollectionLike {
  readonly documents = new Map<string, SyntheticRecord>(); readonly indexes: unknown[] = []; readonly searchIndexes: unknown[] = []; fail = false;
  async findOne(filter: { workspaceId: string; id: string }): Promise<unknown> { const document = this.documents.get(`${filter.workspaceId}:${filter.id}`); return document === undefined ? null : { ...document, _id: "fake-object-id" }; }
  async replaceOne(filter: { workspaceId: string; id: string }, replacement: SyntheticRecord): Promise<void> { if (this.fail) throw new Error("fake failure with dummy-secret"); this.documents.set(`${filter.workspaceId}:${filter.id}`, structuredClone(replacement)); }
  async deleteOne(filter: { workspaceId: string; id: string }): Promise<void> { this.documents.delete(`${filter.workspaceId}:${filter.id}`); }
  async createIndex(keys: Readonly<Record<string, 1 | -1>>, options?: { readonly name?: string; readonly unique?: boolean }): Promise<string> { this.indexes.push({ keys, options }); return options?.name ?? "index"; }
  async createSearchIndex(model: Parameters<MongoCollectionLike["createSearchIndex"]>[0]): Promise<string> { this.searchIndexes.push(model); return "vector"; }
}
class FakeDatabase implements MongoDatabaseLike {
  readonly collections = new Map<string, FakeCollection>(); readonly created: unknown[] = []; readonly commands: unknown[] = [];
  collection(name: string): FakeCollection { const value = this.collections.get(name) ?? new FakeCollection(); this.collections.set(name, value); return value; }
  async createCollection(name: string, options: unknown): Promise<void> { this.created.push({ name, options }); this.collection(name); }
  async command(command: Readonly<Record<string, unknown>>): Promise<void> { this.commands.push(command); }
  listCollections(filter: { readonly name: string }): { toArray(): Promise<Array<{ name: string }>> } { return { toArray: async () => this.collections.has(filter.name) ? [{ name: filter.name }] : [] }; }
}
class FakeClient implements MongoClientLike {
  readonly database = new FakeDatabase(); connected = false; closed = false; failConnect = false;
  async connect(): Promise<void> { if (this.failConnect) throw new Error("connect failed dummy-secret"); this.connected = true; }
  async close(): Promise<void> { this.closed = true; }
  db(): FakeDatabase { return this.database; }
}

test("builds fixed neutral collection names, validators, and workspace indexes", async () => {
  const names = collectionNames("test_namespace"); assert.equal(names.records, "test_namespace_synthetic_records"); assert.equal(names.embeddings, "test_namespace_synthetic_embeddings");
  assert.equal((neutralRecordValidator.$jsonSchema as { additionalProperties: boolean }).additionalProperties, false); assert.equal("labels" in (neutralRecordValidator.$jsonSchema as { properties: object }).properties, false); assert.deepEqual((neutralRecordValidator.$jsonSchema as { properties: { _id: unknown } }).properties._id, { bsonType: "objectId" });
  const definitions = neutralIndexDefinitions("test_namespace"); assert.equal(definitions.records[0].options.unique, true); assert.deepEqual(definitions.records[0].keys, { workspaceId: 1, id: 1 }); assert.equal(definitions.vector.definition.fields[0].numDimensions, 1536); assert.deepEqual(definitions.vector.definition.fields[1], { type: "filter", path: "workspaceId" });
  const database = new FakeDatabase(); const report = await installNeutralMongoInfrastructure(database, "test_namespace"); assert.equal(database.created.length, 2); assert.equal(report.indexes.length, 3);
});
test("upserts by workspace and id and prevents cross-workspace reads", async () => {
  const client = new FakeClient(); const store = new NeutralRecordStore(client, "test", "test_namespace"); await store.upsert(record); await store.upsert({ ...record, payload: { neutral: false } });
  assert.deepEqual((await store.get("demo", record.id))?.payload, { neutral: false }); assert.equal(await store.get("other", record.id), null); await store.delete(record.workspaceId, record.id); assert.equal(await store.get(record.workspaceId, record.id), null);
});
test("passes bounded timeout options and closes a failed connection", async () => {
  const client = new FakeClient(); let received: unknown; const created = createMongoClient({ uri: "mongodb://dummy.example.test", database: "test", namespace: "test_namespace", timeoutMs: 1234 }, (_uri, options) => { received = options; return client; });
  assert.equal(created, client); assert.deepEqual(received, { serverSelectionTimeoutMS: 1234, connectTimeoutMS: 1234, socketTimeoutMS: 1234 }); client.failConnect = true;
  await assert.rejects(() => connectMongo({ uri: "mongodb://dummyUser:dummyPassword@dummy.example.test", database: "test", namespace: "test_namespace", timeoutMs: 100 }, () => client), /MongoDB operation failed/); assert.equal(client.closed, true);
});
test("redacts adapter failures and requires explicit configured test namespace", () => {
  const error = redactedMongoError(new Error("mongodb://dummyUser:dummyPassword@dummy.example.test"), ["dummyPassword"]); assert.equal(error.message.includes("dummyPassword"), false); assert.throws(() => readMongoCliConfig({ MONGODB_URI: "mongodb://dummy.example.test" }), /MONGODB_TEST_DATABASE/);
});
