import { readFile, writeFile } from "node:fs/promises";

const path = "evals/fixtures/records.json";
const records = JSON.parse(await readFile(path, "utf8")) as unknown[];
await writeFile(path, `${JSON.stringify(records, null, 2)}\n`, "utf8");
console.log(`Reset ${records.length} synthetic records; no labels or product state were changed.`);
