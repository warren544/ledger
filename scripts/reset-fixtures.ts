import { writeCanonicalFixtureSet } from "../src/core/fixture-set.js";

const { records } = await writeCanonicalFixtureSet();
console.log(`Reset ${records.length} canonical neutral synthetic records from the deterministic recipe.`);
