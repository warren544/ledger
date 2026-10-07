import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ESLint } from "eslint";

test("boundary lint rejects a forbidden core-to-adapter import and cleans its isolated fixture", async () => {
  const root = process.cwd(); const directory = await mkdtemp(join(root, "lint-boundary-")); const file = join(root, "src", "core", `.boundary-${Date.now()}.ts`);
  try {
    await writeFile(file, 'export { neutralRecordValidator } from "../adapters/mongo/index.js";\n', "utf8");
    const eslint = new ESLint({ cwd: root, overrideConfigFile: join(root, "eslint.config.mjs") }); const [result] = await eslint.lintFiles([file]);
    assert.equal(result.errorCount, 1); assert.match(result.messages[0]?.message ?? "", /core runtime code cannot import/);
  } finally { await rm(file, { force: true }); await rm(directory, { recursive: true, force: true }); }
});
