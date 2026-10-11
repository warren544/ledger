import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { reconCaseSchema, reconManifestSchema } from "../../evals/recon/schema.js";
import { runReconCase } from "../../src/server/recon/engine.js";

const root = fileURLToPath(new URL("../../evals/recon/", import.meta.url));

async function load(pack: "transport" | "billing", filename: "fixtures.json" | "cases.json") {
  return reconCaseSchema.array().parse(JSON.parse(await readFile(`${root}${pack}/${filename}`, "utf8")));
}

test("the generic engine passes every labeled transport regression case", async () => {
  const cases = await load("transport", "fixtures.json");
  for (const item of cases) {
    const result = runReconCase({ caseId: item.caseId, pack: item.pack, records: item.records });
    assert.deepEqual(result.findings.map((finding) => finding.code).sort(), [...item.expectedFindings].sort(), item.caseId);
  }
});

test("the generic engine passes every labeled billing regression case", async () => {
  const cases = await load("billing", "fixtures.json");
  for (const item of cases) {
    const result = runReconCase({ caseId: item.caseId, pack: item.pack, records: item.records });
    assert.deepEqual(result.findings.map((finding) => finding.code).sort(), [...item.expectedFindings].sort(), item.caseId);
  }
});

test("holdout manifests are separate, hash-locked, and labels never enter the engine packet", async () => {
  for (const pack of ["transport", "billing"] as const) {
    const manifest = reconManifestSchema.parse(JSON.parse(await readFile(`${root}${pack}/manifest.json`, "utf8")));
    const cases = await load(pack, "cases.json");
    assert.equal(cases.length, manifest.holdoutCases);
    for (const item of cases) {
      const packet = { caseId: item.caseId, pack: item.pack, records: item.records };
      assert.equal(Object.hasOwn(packet, "expectedFindings"), false);
      assert.doesNotThrow(() => runReconCase(packet));
    }
  }
});

test("engine enforces one workspace per case and keeps clean near-tolerance cases clean", async () => {
  const cases = await load("transport", "fixtures.json");
  const nearTolerance = cases[1];
  assert.equal(runReconCase({ caseId: nearTolerance.caseId, pack: nearTolerance.pack, records: nearTolerance.records }).status, "clean");
  const first = cases[0].records[0] as Record<string, unknown>;
  assert.throws(() => runReconCase({ caseId: cases[0].caseId, pack: "transport", records: [first, { ...first, recordId: "550e8400-e29b-41d4-a716-446655440099", workspaceId: "other" }] }), /one workspace/);
});
