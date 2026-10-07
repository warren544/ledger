import "../src/lib/load-env.js";
import { readFixtureData } from "../src/core/fixture-set.js";

const { records, manifest } = await readFixtureData();
console.log(JSON.stringify({ records: records.length, datasetId: manifest.datasetId, datasetHash: manifest.datasetHash, labelsWithheld: manifest.labelsWithheld, kinds: [...new Set(records.map((record) => record.kind))] }, null, 2));
