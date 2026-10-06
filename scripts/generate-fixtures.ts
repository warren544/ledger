import { writeCanonicalFixtureSet } from "../src/core/fixture-set.js";

const { records, manifest } = await writeCanonicalFixtureSet();
console.log(`Generated ${records.length} neutral synthetic records with dataset hash ${manifest.datasetHash}.`);
