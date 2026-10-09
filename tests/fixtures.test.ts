import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { FIXTURE_RECIPE, generateSyntheticRecords } from "../src/core/fixture-recipe.js";
import { hashRecords } from "../src/core/fixture-hash.js";
import { createManifest, readFixtureData, verifyFixtureData, writeCanonicalFixtureSet, type FixturePaths } from "../src/core/fixture-set.js";
import { parseSyntheticRecords } from "../src/core/types.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

test("generates deterministic neutral records with fixed timestamps and UUIDs", () => {
  const first = generateSyntheticRecords();
  const second = generateSyntheticRecords();
  assert.deepEqual(first, second);
  assert.equal(first.length, 12);
  assert.equal(first[0].createdAt, FIXTURE_RECIPE.referenceTimestamp);
  assert.equal(first.at(-1)?.createdAt, "2026-10-03T06:00:00.000Z");
  assert.equal(new Set(first.map((record) => record.id)).size, first.length);
  assert.equal(new Set(first.map((record) => record.customerId)).size, first.length);
  assert.ok(first.every((record) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.id)));
  assert.ok(first.every((record) => !Object.hasOwn(record, "labels")));
});

test("matches the frozen SHA-256 test vector and changes with order or value", () => {
  const records = generateSyntheticRecords();
  assert.equal(hashRecords(records), "520da190d1bd598f2750b9361536ddf9d339bc61e8185c56ea0d5542bfaaa869");
  assert.notEqual(hashRecords([...records].reverse()), hashRecords(records));
  const changed = structuredClone(records);
  changed[0].payload = { ...changed[0].payload, value: 9999 };
  assert.notEqual(hashRecords(changed), hashRecords(records));
});

test("rejects schema violations, duplicate IDs, and unexpected labels", () => {
  const records = generateSyntheticRecords();
  assert.throws(() => parseSyntheticRecords([{ ...records[0], schemaVersion: 2 }]), /schemaVersion/);
  assert.throws(() => parseSyntheticRecords([{ ...records[0], labels: ["hidden"] }]), /Unrecognized key/);
  assert.throws(() => parseSyntheticRecords([...records, records[0]]), /duplicate record id/);
  assert.throws(() => parseSyntheticRecords([{ ...records[0], payload: { invalid: Number.NaN } }]), /received NaN/);
});

test("rejects frozen manifest count and hash mismatches", () => {
  const records = generateSyntheticRecords();
  const manifest = createManifest(records);
  assert.throws(() => verifyFixtureData(records, { ...manifest, records: manifest.records + 1 }), /manifest mismatch/);
  assert.throws(() => verifyFixtureData(records, { ...manifest, datasetHash: "0".repeat(64) }), /manifest mismatch/);
});

test("restores corrupted temporary fixtures from the recipe, not current contents", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "ledger-fixtures-"));
  try {
    const paths: FixturePaths = { records: resolve(temporary, "records.json"), manifest: resolve(temporary, "manifest.json") };
    await writeCanonicalFixtureSet(paths);
    const canonicalBytes = await readFile(paths.records);
    await writeFile(paths.records, "{\"corrupted\":true}\n", "utf8");
    await assert.rejects(() => readFixtureData(paths));
    await writeCanonicalFixtureSet(paths);
    assert.deepEqual(await readFile(paths.records), canonicalBytes);
    await readFixtureData(paths);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("fixture inspection resolves paths from its module when launched elsewhere", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "ledger-fixtures-cwd-"));
  try {
    const output = execFileSync(process.execPath, [resolve(repoRoot, "node_modules/tsx/dist/cli.mjs"), resolve(repoRoot, "scripts/inspect-fixtures.ts")], {
      cwd: temporary,
      env: process.env,
      encoding: "utf8"
    });
    assert.match(output, /"records": 12/);
    assert.match(output, /520da190d1bd598f2750b9361536ddf9d339bc61e8185c56ea0d5542bfaaa869/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
