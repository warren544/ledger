import "../src/lib/load-env.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseSyntheticRecords } from "../src/core/types.js";
import { connectMongo, NeutralRecordStore } from "../src/adapters/mongo/index.js";
import { readMongoCliConfig } from "../src/server/mongo.js";

const recordsPath = fileURLToPath(new URL("../evals/fixtures/records.json", import.meta.url));

async function readCanonicalRecords() {
  const records = parseSyntheticRecords(JSON.parse(await readFile(recordsPath, "utf8")) as unknown);
  if (records.length === 0) throw new Error("canonical fixture set is empty");
  return records;
}

const config = readMongoCliConfig(process.env);
const records = await readCanonicalRecords();
const client = await connectMongo(config);
const store = new NeutralRecordStore(client, config.database, config.namespace);

let insertedCount = 0;
let updatedCount = 0;
try {
  for (const record of records) {
    const existing = await store.get(record.workspaceId, record.id);
    await store.upsert(record);
    if (existing === null) insertedCount += 1;
    else updatedCount += 1;
  }
  console.log(JSON.stringify({
    source: "canonical-neutral-fixtures",
    database: config.database,
    namespace: config.namespace,
    totalCount: records.length,
    insertedCount,
    updatedCount
  }, null, 2));
} finally {
  await store.close();
}
