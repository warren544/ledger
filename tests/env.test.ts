import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { readEnv } from "../src/lib/env.js";

test("uses safe defaults for the prebuild shell", () => {
  assert.deepEqual(readEnv({}), { nodeEnv: "development", workspaceId: "demo", mongodbUri: undefined, openaiApiKey: undefined });
});

test("rejects an invalid workspace id", () => {
  assert.throws(() => readEnv({ LEDGER_WORKSPACE_ID: "bad id" }), /nonempty identifier/);
});

test("accepts every supported NODE_ENV value", () => {
  for (const nodeEnv of ["development", "test", "production"] as const) {
    assert.equal(readEnv({ NODE_ENV: nodeEnv }).nodeEnv, nodeEnv);
  }
});

test("rejects unsupported, empty, whitespace, and padded NODE_ENV values", () => {
  for (const nodeEnv of ["staging", "", "   ", " test "]) {
    assert.throws(() => readEnv({ NODE_ENV: nodeEnv }), /NODE_ENV/);
  }
});

test("defaults the workspace and rejects empty, whitespace, and invalid IDs", () => {
  assert.equal(readEnv({}).workspaceId, "demo");
  for (const workspaceId of ["", "   ", "bad id", "bad.id", "-starts-with-dash"]) {
    assert.throws(() => readEnv({ LEDGER_WORKSPACE_ID: workspaceId }), /LEDGER_WORKSPACE_ID/);
  }
});

test("treats absent, empty, and whitespace-only optional values as undefined", () => {
  assert.deepEqual(readEnv({ MONGODB_URI: "", OPENAI_API_KEY: "   " }), {
    nodeEnv: "development",
    workspaceId: "demo",
    mongodbUri: undefined,
    openaiApiKey: undefined
  });
});

test("rejects surrounding whitespace on nonempty optional values", () => {
  assert.throws(() => readEnv({ MONGODB_URI: " mongodb://localhost:27017/" }), /MONGODB_URI.*surrounding whitespace/);
  assert.throws(() => readEnv({ OPENAI_API_KEY: " fake-key " }), /OPENAI_API_KEY.*surrounding whitespace/);
});

test("accepts valid standard MongoDB URIs without connecting", () => {
  assert.equal(readEnv({ MONGODB_URI: "mongodb://localhost:27017/ledger_demo" }).mongodbUri, "mongodb://localhost:27017/ledger_demo");
  assert.equal(readEnv({ MONGODB_URI: "mongodb://fake%40user:fake%3Apassword@host1:27017,host2:27018/?replicaSet=demo" }).mongodbUri, "mongodb://fake%40user:fake%3Apassword@host1:27017,host2:27018/?replicaSet=demo");
});

test("accepts a valid SRV MongoDB URI without DNS lookup", () => {
  const uri = "mongodb+srv://fake-user:fake-password@cluster.example.com/ledger_demo?retryWrites=true&w=majority";
  assert.equal(readEnv({ MONGODB_URI: uri }).mongodbUri, uri);
});

test("rejects malformed and unsupported MongoDB URI schemes", () => {
  for (const uri of [
    "postgres://localhost:5432/ledger",
    "http://localhost:27017",
    "mongodb://",
    "mongodb://:27017",
    "mongodb://localhost:not-a-port",
    "mongodb://localhost:0",
    "mongodb://localhost:65536",
    "mongodb://host1,,host2"
  ]) {
    assert.throws(() => readEnv({ MONGODB_URI: uri }), /MONGODB_URI/);
  }
});

test("rejects invalid SRV host forms", () => {
  for (const uri of [
    "mongodb+srv://localhost/ledger",
    "mongodb+srv://127.0.0.1/ledger",
    "mongodb+srv://cluster.example.com:27017/ledger",
    "mongodb+srv://cluster.example.com,other.example.com/ledger",
    "mongodb+srv://cluster.example/ledger"
  ]) {
    assert.throws(() => readEnv({ MONGODB_URI: uri }), /MONGODB_URI/);
  }
});

test("does not disclose fake credentials in validation errors or doctor output", () => {
  const fakeUri = "mongodb://fake-user:fake-secret@bad host";
  assert.throws(() => readEnv({ MONGODB_URI: fakeUri }), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.doesNotMatch(error.message, /fake-user|fake-secret|bad host/);
    return true;
  });
  const output = execFileSync(process.execPath, ["--import", "tsx", resolve("scripts/doctor.ts")], {
    cwd: resolve("."),
    env: { ...process.env, MONGODB_URI: "mongodb://fake-user:fake-secret@localhost:27017/ledger", OPENAI_API_KEY: "fake-api-key" },
    encoding: "utf8"
  });
  assert.doesNotMatch(output, /fake-user|fake-secret|fake-api-key|mongodb:\/\//);
  assert.match(output, /"mongodb": true/);
  assert.match(output, /"mongodb": "not_checked"/);
});
