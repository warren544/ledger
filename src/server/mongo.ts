import { randomUUID } from "node:crypto";
import { readEnv } from "../lib/env.js";
import { createIdGenerator } from "../core/ids.js";
import { connectMongo, installNeutralMongoInfrastructure, NeutralRecordStore, type MongoClientFactory, type MongoConfig } from "../adapters/mongo/index.js";
import type { SyntheticRecord } from "../core/types.js";

export interface MongoCliConfig extends MongoConfig { readonly timeoutMs: number; }
export function readMongoCliConfig(input: Readonly<Record<string, string | undefined>> = process.env): MongoCliConfig {
  const env = readEnv(input); const database = input.MONGODB_TEST_DATABASE; const namespace = input.MONGODB_TEST_NAMESPACE;
  if (!env.mongodbUri) throw new Error("MONGODB_URI is required for Mongo operations"); if (!database) throw new Error("MONGODB_TEST_DATABASE is required; no database default is used"); if (!namespace) throw new Error("MONGODB_TEST_NAMESPACE is required; no collection namespace default is used");
  const timeoutMs = input.MONGODB_TIMEOUT_MS === undefined ? 5000 : Number(input.MONGODB_TIMEOUT_MS); if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error("MONGODB_TIMEOUT_MS must be a positive safe integer");
  return { uri: env.mongodbUri, database, namespace, timeoutMs };
}
export async function runMongoSetup(input: Readonly<Record<string, string | undefined>>, confirmSynthetic: boolean, factory?: MongoClientFactory): Promise<void> {
  if (!confirmSynthetic) throw new Error("remote Mongo setup requires --confirm-synthetic"); const config = readMongoCliConfig(input); const client = await connectMongo(config, factory);
  try {
    const report = await installNeutralMongoInfrastructure(client.db(config.database), config.namespace);
    console.log(JSON.stringify({ ...report, database: config.database }, null, 2));
  } finally { await client.close(); }
}
export async function runMongoSmoke(input: Readonly<Record<string, string | undefined>>, factory?: MongoClientFactory): Promise<void> {
  const config = readMongoCliConfig(input); const client = await connectMongo(config, factory); const store = new NeutralRecordStore(client, config.database, config.namespace); const id = createIdGenerator(randomUUID)(); const workspaceId = "smoke_primary";
  const record: SyntheticRecord = { id, workspaceId, schemaVersion: 1, createdAt: "2026-10-06T00:00:00.000Z", kind: "email", customerId: createIdGenerator(randomUUID)(), source: "synthetic", payload: { smoke: true, marker: "neutral" } };
  try { await store.upsert(record); const found = await store.get(workspaceId, id); if (!found) throw new Error("Mongo smoke readback failed"); if (await store.get("smoke_other", id) !== null) throw new Error("Mongo workspace isolation failed"); console.log(JSON.stringify({ ok: true, workspaceId, recordId: id, otherWorkspaceRead: null, cleanup: "pending" }, null, 2)); }
  finally { try { await store.delete(workspaceId, id); } finally { await store.close(); } }
  console.log(JSON.stringify({ cleanup: "deleted-own-record" }));
}
