import assert from "node:assert/strict";
import test from "node:test";
import {
  trackHumanApproval,
  trackHumanCorrection,
  withExceptionDraftTelemetry,
  withRuleProposalTelemetry,
  type RaindropTelemetryClient,
} from "../src/server/adapters/raindrop.js";

function fakeClient() {
  const calls: Array<{ kind: string; value: unknown }> = [];
  const client: RaindropTelemetryClient = {
    begin(input) {
      calls.push({ kind: "begin", value: input });
      return {
        async finish(input) {
          calls.push({ kind: "finish", value: input });
        },
      };
    },
    trackSignal(signal) {
      calls.push({ kind: "signal", value: signal });
    },
  };
  return { client, calls };
}

const context = { eventId: "evt-1", userId: "user-1", packName: "transport", ruleIds: ["P1", "P5"] } as const;

test("exception drafting begins and finishes with pack and cited rule properties", async () => {
  const { client, calls } = fakeClient();
  const result = await withExceptionDraftTelemetry(client, context, async () => ({ draft: "neutral" }));
  assert.deepEqual(result, { draft: "neutral" });
  assert.deepEqual(calls, [
    { kind: "begin", value: { eventId: "evt-1", event: "exception_draft", userId: "user-1", properties: { packName: "transport", ruleIds: ["P1", "P5"] } } },
    { kind: "finish", value: { output: '{"draft":"neutral"}' } },
  ]);
});

test("rule proposal failures still finish the interaction and preserve the original error", async () => {
  const { client, calls } = fakeClient();
  const failure = new Error("proposal failed");
  await assert.rejects(withRuleProposalTelemetry(client, context, async () => { throw failure; }), failure);
  assert.equal((calls[0]?.value as { event: string }).event, "rule_proposal");
  assert.deepEqual(calls[1], { kind: "finish", value: { output: "operation failed" } });
});

test("telemetry begin and finish failures do not change the operation result", async () => {
  const client: RaindropTelemetryClient = {
    begin() {
      throw new Error("Invalid X-Raindrop-Project-Id");
    },
    trackSignal() {}
  };
  assert.equal(await withRuleProposalTelemetry(client, context, async () => "proposal"), "proposal");

  const finishingClient: RaindropTelemetryClient = {
    begin() {
      return { async finish() { throw new Error("flush failed"); } };
    },
    trackSignal() {}
  };
  assert.equal(await withExceptionDraftTelemetry(finishingClient, context, async () => "draft"), "draft");
});

test("feedback signal failures are swallowed", async () => {
  const client: RaindropTelemetryClient = {
    begin: () => ({ finish: async () => {} }),
    trackSignal() {
      throw new Error("track_partial failed");
    }
  };
  trackHumanApproval(client, "evt-1");
  trackHumanCorrection(client, "evt-1", "dummy correction");
});

test("human feedback is tied to the originating event and correction is a comment", () => {
  const { client, calls } = fakeClient();
  trackHumanApproval(client, "evt-1");
  trackHumanCorrection(client, "evt-1", "Use the posted service date.");
  assert.deepEqual(calls.map((call) => call.value), [
    { eventId: "evt-1", name: "thumbs_up", type: "feedback", sentiment: "POSITIVE" },
    { eventId: "evt-1", name: "thumbs_down", type: "feedback", sentiment: "NEGATIVE", comment: "Use the posted service date." },
  ]);
});
