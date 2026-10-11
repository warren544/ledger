import { MongoClient, type MongoClientOptions } from "mongodb";
import { redact } from "../../core/redaction.js";
import { parseSyntheticRecords, type SyntheticRecord } from "../../core/types.js";

export const RECORDS_SUFFIX = "_synthetic_records";
export const EMBEDDINGS_SUFFIX = "_synthetic_embeddings";
export const VECTOR_INDEX_NAME = "synthetic_embeddings_vector";
export const DEFAULT_MONGO_TIMEOUT_MS = 5000;

export interface MongoConfig { readonly uri: string; readonly database: string; readonly namespace: string; readonly timeoutMs?: number; }
export interface MongoFilter { readonly workspaceId: string; readonly id?: string; readonly recordId?: string; }
export interface SearchIndexDefinition {
  readonly name: string;
  readonly type: "vectorSearch";
  readonly definition: { readonly fields: readonly [{ readonly type: "vector"; readonly path: "embedding"; readonly numDimensions: 1536; readonly similarity: "cosine" }, { readonly type: "filter"; readonly path: "workspaceId" }] };
}
export interface MongoCollectionLike {
  findOne(filter: Readonly<Record<string, unknown>>): Promise<unknown>;
  find?(filter: Readonly<Record<string, unknown>>, options?: Readonly<Record<string, unknown>>): { toArray(): Promise<readonly unknown[]> };
  insertOne?(document: unknown): Promise<unknown>;
  updateOne?(filter: Readonly<Record<string, unknown>>, update: unknown, options?: Readonly<Record<string, unknown>>): Promise<unknown>;
  countDocuments?(filter: Readonly<Record<string, unknown>>): Promise<number>;
  replaceOne(filter: Readonly<Record<string, unknown>>, replacement: unknown, options: { readonly upsert: true }): Promise<unknown>;
  deleteOne(filter: Readonly<Record<string, unknown>>): Promise<unknown>;
  createIndex(keys: Readonly<Record<string, 1 | -1>>, options?: { readonly name?: string; readonly unique?: boolean }): Promise<string>;
  createSearchIndex(model: SearchIndexDefinition): Promise<string>;
  listSearchIndexes?(name?: string): { toArray(): Promise<readonly unknown[]> };
  aggregate?(pipeline: readonly unknown[]): { toArray(): Promise<readonly unknown[]> };
}
export interface MongoDatabaseLike {
  collection(name: string): MongoCollectionLike;
  createCollection(name: string, options: { readonly validator: unknown; readonly validationLevel: "strict"; readonly validationAction: "error" }): Promise<unknown>;
  command(command: Readonly<Record<string, unknown>>): Promise<unknown>;
  listCollections(filter: { readonly name: string }, options: { readonly nameOnly: true }): { toArray(): Promise<Array<{ name: string }>> };
}
export interface MongoClientLike { connect(): Promise<unknown>; close(): Promise<void>; db(name: string): MongoDatabaseLike; }
export type MongoClientFactory = (uri: string, options: MongoClientOptions) => MongoClientLike;

const UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$";
const WORKSPACE_PATTERN = "^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$";

export const neutralRecordValidator = {
  $jsonSchema: {
    bsonType: "object", additionalProperties: false,
    required: ["id", "workspaceId", "schemaVersion", "createdAt", "kind", "customerId", "source", "payload"],
    properties: {
      _id: { bsonType: "objectId" }, id: { bsonType: "string", pattern: UUID_PATTERN }, workspaceId: { bsonType: "string", pattern: WORKSPACE_PATTERN }, schemaVersion: { bsonType: "int", enum: [1] },
      createdAt: { bsonType: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T.*Z$" }, kind: { bsonType: "string", enum: ["invoice", "rate_sheet", "service_log", "email"] },
      customerId: { bsonType: "string", pattern: UUID_PATTERN }, source: { bsonType: "string", enum: ["synthetic"] }, payload: { bsonType: "object" }
    }
  }
} as const;

export const neutralEmbeddingValidator = {
  $jsonSchema: {
    bsonType: "object", additionalProperties: false, required: ["recordId", "workspaceId", "embedding"],
    properties: { _id: { bsonType: "objectId" }, recordId: { bsonType: "string", pattern: UUID_PATTERN }, workspaceId: { bsonType: "string", pattern: WORKSPACE_PATTERN }, embedding: { bsonType: "array", minItems: 1536, maxItems: 1536, items: { bsonType: "double" } } }
  }
} as const;

export function validateNamespace(namespace: string): string {
  if (!/^[a-z][a-z0-9_]{0,30}$/.test(namespace)) throw new Error("Mongo namespace must be lowercase alphanumeric/underscore and start with a letter");
  return namespace;
}
export function collectionNames(namespace: string): { readonly records: string; readonly embeddings: string } {
  const safe = validateNamespace(namespace); return { records: `${safe}${RECORDS_SUFFIX}`, embeddings: `${safe}${EMBEDDINGS_SUFFIX}` };
}
export function neutralIndexDefinitions(namespace: string) {
  const names = collectionNames(namespace);
  return {
    records: [{ keys: { workspaceId: 1, id: 1 }, options: { name: `${names.records}_workspace_id_unique`, unique: true } }, { keys: { workspaceId: 1, createdAt: -1 }, options: { name: `${names.records}_workspace_created` } }],
    embeddings: { keys: { workspaceId: 1 }, options: { name: `${names.embeddings}_workspace` } },
    vector: { name: VECTOR_INDEX_NAME, type: "vectorSearch" as const, definition: { fields: [{ type: "vector" as const, path: "embedding" as const, numDimensions: 1536 as const, similarity: "cosine" as const }, { type: "filter" as const, path: "workspaceId" as const }] } }
  } as const;
}
export function redactedMongoError(error: unknown, secrets: readonly string[] = []): Error { return new Error(`MongoDB operation failed: ${JSON.stringify(redact(error, { secrets }))}`); }

function withoutMongoId(document: unknown): unknown {
  if (document === null || typeof document !== "object" || Array.isArray(document)) return document;
  const { _id: ignored, ...record } = document as Record<string, unknown>;
  return record;
}

export function createMongoClient(config: MongoConfig, factory: MongoClientFactory = (uri, options) => new MongoClient(uri, options) as unknown as MongoClientLike): MongoClientLike {
  const timeoutMs = config.timeoutMs ?? DEFAULT_MONGO_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new RangeError("Mongo timeout must be a positive safe integer");
  return factory(config.uri, { serverSelectionTimeoutMS: timeoutMs, connectTimeoutMS: timeoutMs, socketTimeoutMS: timeoutMs });
}
export async function connectMongo(config: MongoConfig, factory?: MongoClientFactory): Promise<MongoClientLike> {
  const client = createMongoClient(config, factory);
  try { await client.connect(); return client; } catch (error) { try { await client.close(); } catch { /* preserve original failure */ } throw redactedMongoError(error, [config.uri]); }
}

export class NeutralRecordStore {
  private readonly records: MongoCollectionLike;
  constructor(private readonly client: MongoClientLike, database: string, namespace: string) { this.records = client.db(database).collection(collectionNames(namespace).records); }
  async get(workspaceId: string, id: string): Promise<SyntheticRecord | null> {
    try { const document = await this.records.findOne({ workspaceId, id }); return document === null ? null : parseSyntheticRecords([withoutMongoId(document)])[0]; } catch (error) { throw redactedMongoError(error); }
  }
  async upsert(record: SyntheticRecord): Promise<void> {
    const validated = parseSyntheticRecords([record])[0];
    try { await this.records.replaceOne({ workspaceId: validated.workspaceId, id: validated.id }, validated, { upsert: true }); } catch (error) { throw redactedMongoError(error); }
  }
  async delete(workspaceId: string, id: string): Promise<void> { try { await this.records.deleteOne({ workspaceId, id }); } catch (error) { throw redactedMongoError(error); } }
  async close(): Promise<void> { await this.client.close(); }
}

export interface NeutralEmbedding { readonly recordId: string; readonly workspaceId: string; readonly embedding: readonly number[]; }

export class NeutralEmbeddingStore {
  private readonly embeddings: MongoCollectionLike;
  constructor(private readonly client: MongoClientLike, database: string, namespace: string) { this.embeddings = client.db(database).collection(collectionNames(namespace).embeddings); }
  async upsert(value: NeutralEmbedding): Promise<void> {
    const recordId = parseSyntheticRecords([{ id: value.recordId, workspaceId: value.workspaceId, schemaVersion: 1, createdAt: "2026-10-06T00:00:00.000Z", kind: "email", customerId: value.recordId, source: "synthetic", payload: {} }])[0].id;
    if (value.embedding.length !== 1536 || value.embedding.some((item) => !Number.isFinite(item))) throw new Error("embedding must contain 1536 finite values");
    try { await this.embeddings.replaceOne({ workspaceId: value.workspaceId, recordId }, { recordId, workspaceId: value.workspaceId, embedding: [...value.embedding] }, { upsert: true }); } catch (error) { throw redactedMongoError(error); }
  }
  async waitForReady(indexName: string, timeoutMs: number, pollMs = 250): Promise<void> {
    if (!this.embeddings.listSearchIndexes) throw new Error("Mongo vector index readiness is unavailable");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
      const indexes = await this.embeddings.listSearchIndexes(indexName).toArray();
      if (indexes.some((item) => (item as { name?: string; queryable?: boolean }).name === indexName && (item as { queryable?: boolean }).queryable === true)) return;
      await new Promise((resolve) => setTimeout(resolve, Math.min(pollMs, Math.max(1, deadline - Date.now()))));
    }
    throw new Error("Mongo vector index did not become ready before timeout");
  }
  async nearest(workspaceId: string, queryVector: readonly number[], limit = 1): Promise<readonly unknown[]> {
    if (!this.embeddings.aggregate) throw new Error("Mongo vector aggregation is unavailable");
    if (queryVector.length !== 1536 || queryVector.some((item) => !Number.isFinite(item))) throw new Error("query vector must contain 1536 finite values");
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) throw new RangeError("vector result limit must be from 1 through 20");
    return this.embeddings.aggregate([{ $vectorSearch: { index: VECTOR_INDEX_NAME, path: "embedding", queryVector: [...queryVector], numCandidates: Math.max(limit, 10), limit, filter: { workspaceId } } }]).toArray();
  }
  async delete(recordId: string, workspaceId: string): Promise<void> { try { await this.embeddings.deleteOne({ recordId, workspaceId }); } catch (error) { throw redactedMongoError(error); } }
  async close(): Promise<void> { await this.client.close(); }
}

async function ensureCollection(database: MongoDatabaseLike, name: string, validator: unknown): Promise<void> {
  const existing = await database.listCollections({ name }, { nameOnly: true }).toArray();
  if (existing.length === 0) {
    try { await database.createCollection(name, { validator, validationLevel: "strict", validationAction: "error" }); return; }
    catch (error) { if ((error as { code?: number }).code !== 48) throw error; }
  }
  await database.command({ collMod: name, validator, validationLevel: "strict", validationAction: "error" });
}
export async function installNeutralMongoInfrastructure(database: MongoDatabaseLike, namespace: string) {
  const names = collectionNames(namespace); await ensureCollection(database, names.records, neutralRecordValidator); await ensureCollection(database, names.embeddings, neutralEmbeddingValidator);
  const definitions = neutralIndexDefinitions(namespace); const records = database.collection(names.records); const embeddings = database.collection(names.embeddings);
  const indexes = [await records.createIndex(definitions.records[0].keys, definitions.records[0].options), await records.createIndex(definitions.records[1].keys, definitions.records[1].options), await embeddings.createIndex(definitions.embeddings.keys, definitions.embeddings.options)];
  const vectorIndex = await embeddings.createSearchIndex(definitions.vector);
  return { database: "configured-by-caller", collections: names, indexes, vectorIndex };
}

export const RECON_COLLECTION_NAMES = [
  "recon_records", "recon_cases", "recon_exceptions", "recon_rules", "recon_corrections", "recon_events", "recon_embeddings"
] as const;

const reconBaseValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["workspaceId", "schemaVersion", "createdAt"],
    properties: {
      workspaceId: { bsonType: "string", pattern: WORKSPACE_PATTERN },
      schemaVersion: { bsonType: "int", enum: [1] },
      createdAt: { bsonType: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T.*Z$" }
    }
  }
} as const;

export const reconCollectionValidators = Object.fromEntries(RECON_COLLECTION_NAMES.map((name) => [name, reconBaseValidator])) as Record<typeof RECON_COLLECTION_NAMES[number], typeof reconBaseValidator>;

export function reconIndexDefinitions() {
  return {
    records: [{ keys: { workspaceId: 1, recordId: 1 }, options: { name: "recon_records_workspace_record_unique", unique: true } }, { keys: { workspaceId: 1, pack: 1, key: 1 }, options: { name: "recon_records_workspace_pack_key" } }],
    cases: [{ keys: { workspaceId: 1, caseId: 1 }, options: { name: "recon_cases_workspace_case_unique", unique: true } }, { keys: { workspaceId: 1, pack: 1, key: 1 }, options: { name: "recon_cases_workspace_pack_key" } }],
    exceptions: [{ keys: { workspaceId: 1, exceptionId: 1 }, options: { name: "recon_exceptions_workspace_exception_unique", unique: true } }, { keys: { workspaceId: 1, caseId: 1, code: 1 }, options: { name: "recon_exceptions_workspace_case_code" } }],
    rules: [{ keys: { workspaceId: 1, ruleId: 1, version: 1 }, options: { name: "recon_rules_workspace_rule_version_unique", unique: true } }],
    corrections: [{ keys: { workspaceId: 1, correctionId: 1 }, options: { name: "recon_corrections_workspace_correction_unique", unique: true } }],
    events: [{ keys: { workspaceId: 1, "chain.index": 1 }, options: { name: "recon_events_workspace_index_unique", unique: true } }, { keys: { workspaceId: 1, subjectId: 1, createdAt: -1 }, options: { name: "recon_events_workspace_subject_created" } }],
    embeddings: [{ keys: { workspaceId: 1, recordId: 1 }, options: { name: "recon_embeddings_workspace_record_unique", unique: true } }],
    vector: { name: "recon_embeddings_vector", type: "vectorSearch" as const, definition: { fields: [{ type: "vector" as const, path: "embedding" as const, numDimensions: 1536 as const, similarity: "cosine" as const }, { type: "filter" as const, path: "workspaceId" as const }] } }
  } as const;
}

export async function installReconMongoInfrastructure(database: MongoDatabaseLike) {
  for (const name of RECON_COLLECTION_NAMES) await ensureCollection(database, name, reconCollectionValidators[name]);
  const definitions = reconIndexDefinitions();
  const indexes: string[] = [];
  for (const name of ["records", "cases", "exceptions", "rules", "corrections", "events", "embeddings"] as const) {
    const collection = database.collection(`recon_${name}`);
    for (const definition of definitions[name]) indexes.push(await collection.createIndex(definition.keys, definition.options));
  }
  const vectorIndex = await database.collection("recon_embeddings").createSearchIndex(definitions.vector);
  return { collections: RECON_COLLECTION_NAMES, indexes, vectorIndex };
}
