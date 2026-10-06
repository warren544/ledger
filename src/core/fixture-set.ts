import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { FIXTURE_RECIPE, generateSyntheticRecords } from "./fixture-recipe.js";
import { hashRecords } from "./fixture-hash.js";
import { fixtureManifestSchema, parseSyntheticRecords, type FixtureManifest, type SyntheticRecord } from "./types.js";

export interface FixturePaths {
  records: string;
  manifest: string;
}

export function canonicalFixturePaths(): FixturePaths {
  return {
    records: fileURLToPath(new URL("../../evals/fixtures/records.json", import.meta.url)),
    manifest: fileURLToPath(new URL("../../evals/fixtures/manifest.json", import.meta.url))
  };
}

export function createManifest(records: SyntheticRecord[]): FixtureManifest {
  const validated = parseSyntheticRecords(records);
  return {
    datasetId: FIXTURE_RECIPE.datasetId,
    generatorVersion: FIXTURE_RECIPE.generatorVersion,
    seed: FIXTURE_RECIPE.seed,
    schemaVersion: FIXTURE_RECIPE.schemaVersion,
    generatedAt: FIXTURE_RECIPE.generatedAt,
    records: validated.length,
    datasetHash: hashRecords(validated),
    labelsWithheld: true
  };
}

function parseJson(text: string, name: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${name} is not valid JSON`);
  }
}

export function verifyFixtureData(recordsInput: unknown, manifestInput: unknown): { records: SyntheticRecord[]; manifest: FixtureManifest } {
  const records = parseSyntheticRecords(recordsInput);
  const manifest = fixtureManifestSchema.parse(manifestInput);
  const expected = createManifest(records);
  const mismatch = Object.entries(expected).find(([key, value]) => manifest[key as keyof FixtureManifest] !== value);
  if (mismatch) throw new Error(`fixture manifest mismatch in ${mismatch[0]}`);
  return { records, manifest };
}

export async function readFixtureData(paths: FixturePaths = canonicalFixturePaths()): Promise<{ records: SyntheticRecord[]; manifest: FixtureManifest }> {
  const [recordsText, manifestText] = await Promise.all([
    readFile(paths.records, "utf8"),
    readFile(paths.manifest, "utf8")
  ]);
  return verifyFixtureData(parseJson(recordsText, "records.json"), parseJson(manifestText, "manifest.json"));
}

export async function writeCanonicalFixtureSet(paths: FixturePaths = canonicalFixturePaths()): Promise<{ records: SyntheticRecord[]; manifest: FixtureManifest }> {
  const records = generateSyntheticRecords();
  const manifest = createManifest(records);
  await mkdir(dirname(paths.records), { recursive: true });
  await mkdir(dirname(paths.manifest), { recursive: true });
  await writeFile(paths.records, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  await writeFile(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { records, manifest };
}
