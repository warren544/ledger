import { randomUUID } from "node:crypto";
import { appendHashChainEntry, verifyHashChain, type ChainJsonValue, type HashChain, type HashChainEntry } from "../../core/hash-chain.js";
import { reconCaseSchema, type ReconCase } from "../../core/recon/record-types.js";
import { exceptionSchema, type ReconException } from "../../core/recon/exception.js";
import { ruleSchema, type ReconRule } from "../../core/recon/rules.js";
import type { MongoCollectionLike, MongoDatabaseLike } from "../../adapters/mongo/index.js";
import type { StoredDraft } from "./drafter.js";

export interface ReconEventInput {
  readonly workspaceId: string;
  readonly actorId: string;
  readonly subjectId: string;
  readonly type: string;
  readonly payload: ChainJsonValue;
}

export interface StoredReconEvent {
  readonly schemaVersion: 1;
  readonly workspaceId: string;
  readonly eventId: string;
  readonly actorId: string;
  readonly subjectId: string;
  readonly type: string;
  readonly createdAt: string;
  readonly chain: HashChainEntry;
}

export interface ReconCorrection {
  readonly schemaVersion: 1;
  readonly correctionId: string;
  readonly workspaceId: string;
  readonly caseId: string;
  readonly exceptionId: string;
  readonly actorId: string;
  readonly disposition: string;
  readonly notes: string;
  readonly createdAt: string;
}

export interface ReconRepository {
  upsertRecord(record: Record<string, unknown>): Promise<void>;
  upsertCase(reconCase: ReconCase): Promise<void>;
  updateCase(reconCase: ReconCase): Promise<void>;
  getCase(workspaceId: string, caseId: string): Promise<ReconCase | null>;
  listCases(workspaceId: string, pack?: string, status?: string): Promise<readonly ReconCase[]>;
  getRecords(workspaceId: string, recordIds: readonly string[]): Promise<readonly Record<string, unknown>[]>;
  insertException(exception: ReconException): Promise<void>;
  updateException(exception: ReconException): Promise<void>;
  getException(workspaceId: string, exceptionId: string): Promise<ReconException | null>;
  listExceptions(workspaceId: string, caseId: string): Promise<readonly ReconException[]>;
  saveDraft(workspaceId: string, exceptionId: string, draft: StoredDraft): Promise<void>;
  getDraft(workspaceId: string, exceptionId: string): Promise<StoredDraft | null>;
  insertCorrection(correction: ReconCorrection): Promise<void>;
  getCorrection(workspaceId: string, correctionId: string): Promise<ReconCorrection | null>;
  insertRule(rule: ReconRule): Promise<void>;
  updateRule(rule: ReconRule): Promise<void>;
  getRule(workspaceId: string, ruleId: string, version?: number): Promise<ReconRule | null>;
  listRules(workspaceId: string): Promise<readonly ReconRule[]>;
  listEvents(workspaceId: string, subjectId?: string): Promise<readonly StoredReconEvent[]>;
  appendEvent(input: ReconEventInput): Promise<StoredReconEvent>;
  verifyEvents(workspaceId: string): Promise<{ readonly valid: boolean; readonly count: number; readonly head: string; readonly index: number | null; readonly reason?: string }>;
}

type RequiredReconCollection = Omit<MongoCollectionLike, "find" | "insertOne"> & { find(filter: Readonly<Record<string, unknown>>, options?: Readonly<Record<string, unknown>>): { toArray(): Promise<readonly unknown[]> }; insertOne(document: unknown): Promise<unknown> };

function requireCollection(database: MongoDatabaseLike, name: string): RequiredReconCollection {
  const collection = database.collection(name);
  if (!collection.find || !collection.insertOne) throw new Error(`Mongo collection ${name} lacks required persistence methods`);
  return collection as RequiredReconCollection;
}

function requireUpdateCollection(database: MongoDatabaseLike, name: string) {
  const collection = requireCollection(database, name);
  if (!collection.updateOne) throw new Error(`Mongo collection ${name} lacks update support`);
  return collection as RequiredReconCollection & { updateOne(filter: Readonly<Record<string, unknown>>, update: unknown, options?: Readonly<Record<string, unknown>>): Promise<unknown> };
}

function asChainEntry(value: unknown): HashChainEntry | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const chain = (value as { chain?: unknown }).chain;
  if (chain === null || typeof chain !== "object" || Array.isArray(chain)) return null;
  return chain as HashChainEntry;
}

function sortedEvents(values: readonly unknown[]): StoredReconEvent[] {
  return values.filter((value): value is StoredReconEvent => asChainEntry(value) !== null).sort((left, right) => left.chain.index - right.chain.index);
}

function withoutMongoId(value: unknown): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const { _id: ignored, ...document } = value as Record<string, unknown>;
  return document;
}

function withoutStoredRecordMetadata(value: unknown): unknown {
  const clean = withoutMongoId(value);
  if (clean === null || typeof clean !== "object" || Array.isArray(clean)) return clean;
  const { pack: ignoredPack, key: ignoredKey, createdAt: ignoredCreatedAt, ...record } = clean as Record<string, unknown>;
  return record;
}

function withoutStoredCaseMetadata(value: unknown): unknown {
  const clean = withoutMongoId(value);
  if (clean === null || typeof clean !== "object" || Array.isArray(clean)) return clean;
  const { createdAt: ignoredCreatedAt, schemaVersion: ignoredSchemaVersion, ...reconCase } = clean as Record<string, unknown>;
  return reconCase;
}

function withoutDraft(value: unknown): unknown {
  const clean = withoutMongoId(value);
  if (clean === null || typeof clean !== "object" || Array.isArray(clean)) return clean;
  const { draft: ignoredDraft, schemaVersion: ignoredSchemaVersion, ...exception } = clean as Record<string, unknown>;
  return exception;
}

export function createReconRepository(database: MongoDatabaseLike, clock: () => string = () => new Date().toISOString()): ReconRepository {
  return {
    async upsertRecord(record) {
      const collection = requireUpdateCollection(database, "recon_records");
      await collection.updateOne({ workspaceId: record.workspaceId, recordId: record.recordId }, { $set: record }, { upsert: true });
    },
    async upsertCase(reconCase) {
      const collection = requireUpdateCollection(database, "recon_cases");
      await collection.updateOne({ workspaceId: reconCase.workspaceId, caseId: reconCase.caseId }, { $set: { ...reconCase, schemaVersion: 1, createdAt: clock() } }, { upsert: true });
    },
    async updateCase(reconCase) {
      const collection = requireUpdateCollection(database, "recon_cases");
      await collection.updateOne({ workspaceId: reconCase.workspaceId, caseId: reconCase.caseId }, { $set: { ...reconCase, schemaVersion: 1, createdAt: clock() } }, { upsert: false });
    },
    async getCase(workspaceId, caseId) {
      const collection = database.collection("recon_cases");
      const value = await collection.findOne({ workspaceId, caseId });
      return value === null ? null : reconCaseSchema.parse(withoutStoredCaseMetadata(value));
    },
    async listCases(workspaceId, pack, status) {
      const filter: Record<string, unknown> = { workspaceId };
      if (pack !== undefined) filter.pack = pack;
      if (status !== undefined) filter.status = status;
      const collection = requireCollection(database, "recon_cases");
      return (await collection.find(filter, { sort: { createdAt: -1 } }).toArray()).map((value) => reconCaseSchema.parse(withoutStoredCaseMetadata(value)));
    },
    async getRecords(workspaceId, recordIds) {
      const collection = database.collection("recon_records");
      const result: Record<string, unknown>[] = [];
      for (const recordId of recordIds) {
        const value = await collection.findOne({ workspaceId, recordId });
        const clean = withoutStoredRecordMetadata(value);
        if (clean !== null && typeof clean === "object" && !Array.isArray(clean)) result.push(clean as Record<string, unknown>);
      }
      return result;
    },
    async insertException(exception) {
      const collection = requireUpdateCollection(database, "recon_exceptions");
      await collection.updateOne({ workspaceId: exception.workspaceId, exceptionId: exception.exceptionId }, { $set: { ...exception, schemaVersion: 1, createdAt: exception.createdAt } }, { upsert: true });
    },
    async updateException(exception) {
      const collection = requireUpdateCollection(database, "recon_exceptions");
      await collection.updateOne({ workspaceId: exception.workspaceId, exceptionId: exception.exceptionId }, { $set: { ...exception, schemaVersion: 1, createdAt: exception.createdAt } }, { upsert: false });
    },
    async getException(workspaceId, exceptionId) {
      const value = await database.collection("recon_exceptions").findOne({ workspaceId, exceptionId });
      return value === null ? null : exceptionSchema.parse(withoutDraft(value));
    },
    async listExceptions(workspaceId, caseId) {
      const collection = requireCollection(database, "recon_exceptions");
      return (await collection.find({ workspaceId, caseId }, { sort: { createdAt: 1 } }).toArray()).map((value) => exceptionSchema.parse(withoutDraft(value)));
    },
    async saveDraft(workspaceId, exceptionId, draft) {
      const collection = requireUpdateCollection(database, "recon_exceptions");
      await collection.updateOne({ workspaceId, exceptionId }, { $set: { draft } }, { upsert: false });
    },
    async getDraft(workspaceId, exceptionId) {
      const value = await database.collection("recon_exceptions").findOne({ workspaceId, exceptionId });
      if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
      const draft = (value as { draft?: unknown }).draft;
      return draft === undefined ? null : draft as StoredDraft;
    },
    async insertCorrection(correction) {
      const collection = requireUpdateCollection(database, "recon_corrections");
      await collection.updateOne({ workspaceId: correction.workspaceId, correctionId: correction.correctionId }, { $set: correction }, { upsert: true });
    },
    async getCorrection(workspaceId, correctionId) {
      const value = await database.collection("recon_corrections").findOne({ workspaceId, correctionId });
      return value === null ? null : withoutMongoId(value) as ReconCorrection;
    },
    async insertRule(rule) {
      const collection = requireUpdateCollection(database, "recon_rules");
      await collection.updateOne({ workspaceId: rule.workspaceId, ruleId: rule.ruleId, version: rule.version }, { $set: rule }, { upsert: true });
    },
    async updateRule(rule) {
      const collection = requireUpdateCollection(database, "recon_rules");
      await collection.updateOne({ workspaceId: rule.workspaceId, ruleId: rule.ruleId, version: rule.version }, { $set: rule }, { upsert: false });
    },
    async getRule(workspaceId, ruleId, version) {
      const collection = database.collection("recon_rules");
      const filter: Record<string, unknown> = { workspaceId, ruleId };
      if (version !== undefined) filter.version = version;
      const value = await collection.findOne(filter);
      if (value === null) return null;
      const clean = withoutMongoId(value);
      return ruleSchema.parse(clean);
    },
    async listRules(workspaceId) {
      const collection = requireCollection(database, "recon_rules");
      return (await collection.find({ workspaceId }, { sort: { ruleId: 1, version: -1 } }).toArray()).map((value) => ruleSchema.parse(withoutMongoId(value)));
    },
    async listEvents(workspaceId, subjectId) {
      const collection = requireCollection(database, "recon_events");
      const filter = subjectId === undefined ? { workspaceId } : { workspaceId, subjectId };
      return sortedEvents(await collection.find(filter, { sort: { "chain.index": 1 } }).toArray());
    },
    async appendEvent(input) {
      const collection = requireCollection(database, "recon_events");
      const values = sortedEvents(await collection.find({ workspaceId: input.workspaceId }, { sort: { "chain.index": 1 } }).toArray());
      const chain: HashChain = values.length === 0 ? [] : values.map((event) => event.chain);
      const eventId = randomUUID();
      const createdAt = clock();
      const entry = appendHashChainEntry(chain, { eventId, type: input.type, actorId: input.actorId, subjectId: input.subjectId, createdAt, payload: input.payload });
      const stored: StoredReconEvent = { schemaVersion: 1, workspaceId: input.workspaceId, eventId, actorId: input.actorId, subjectId: input.subjectId, type: input.type, createdAt, chain: entry[entry.length - 1] };
      await collection.insertOne(stored);
      return stored;
    },
    async verifyEvents(workspaceId) {
      const collection = requireCollection(database, "recon_events");
      const events = sortedEvents(await collection.find({ workspaceId }, { sort: { "chain.index": 1 } }).toArray());
      const result = verifyHashChain(events.map((event) => event.chain), { expectedCount: events.length });
      return result.valid ? { valid: true, count: result.count, head: result.head, index: null } : { valid: false, count: events.length, head: "", index: result.index, reason: result.reason };
    }
  };
}
