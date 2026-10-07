import "../src/lib/load-env.js";
import { readFixtureData } from "../src/core/fixture-set.js";

const { records, manifest } = await readFixtureData();
console.log(`Verified ${records.length} records against frozen manifest ${manifest.datasetHash}.`);
