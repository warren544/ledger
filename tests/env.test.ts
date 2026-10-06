import test from "node:test";
import assert from "node:assert/strict";
import { readEnv } from "../src/lib/env.js";

test("uses safe defaults for the prebuild shell", () => {
  assert.deepEqual(readEnv({}), { nodeEnv: "development", workspaceId: "demo", mongodbUri: undefined, openaiApiKey: undefined });
});

test("rejects an invalid workspace id", () => {
  assert.throws(() => readEnv({ LEDGER_WORKSPACE_ID: "bad id" }), /unsupported characters/);
});
