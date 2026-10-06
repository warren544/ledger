import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SyntheticRecord } from "../src/core/types.js";

const file = resolve("evals/fixtures/records.json");
const records = JSON.parse(await readFile(file, "utf8")) as SyntheticRecord[];
console.log(JSON.stringify({ file, records: records.length, kinds: [...new Set(records.map((r) => r.kind))], source: "synthetic", labelsWithheld: true }, null, 2));
