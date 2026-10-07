import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadLocalEnv } from "../src/lib/load-env.js";

test("loads a temporary env file without overriding existing process values", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ledger-env-loader-"));
  const file = join(directory, ".env.local");
  const loadedName = "LEDGER_TEST_LOADER_FILE_VALUE";
  const existingName = "LEDGER_TEST_LOADER_EXISTING_VALUE";
  const previousLoaded = process.env[loadedName];
  const previousExisting = process.env[existingName];
  process.env[existingName] = "from-process";
  delete process.env[loadedName];
  try {
    await writeFile(file, `${loadedName}=from-file\n${existingName}=from-file\n`, "utf8");
    loadLocalEnv(file);
    assert.equal(process.env[loadedName], "from-file");
    assert.equal(process.env[existingName], "from-process");
  } finally {
    if (previousLoaded === undefined) delete process.env[loadedName]; else process.env[loadedName] = previousLoaded;
    if (previousExisting === undefined) delete process.env[existingName]; else process.env[existingName] = previousExisting;
    await rm(directory, { recursive: true, force: true });
  }
});

test("missing env files are tolerated", () => {
  assert.doesNotThrow(() => loadLocalEnv(join(tmpdir(), "ledger-env-loader-missing.env")));
});
