import Raindrop from "raindrop-ai";
import type { RaindropProperties, SignalEvent } from "raindrop-ai";

/** The SDK is disabled when no write key is configured; values are never logged. */
export function createRaindropClient(): Raindrop {
  return new Raindrop({
    writeKey: process.env.RAINDROP_WRITE_KEY,
    projectId: process.env.RAINDROP_PROJECT_ID,
    disabled: !process.env.RAINDROP_WRITE_KEY,
  });
}

type BeginInput = Parameters<Raindrop["begin"]>[0];
type FinishInput = Parameters<ReturnType<Raindrop["begin"]>["finish"]>[0];
type SignalInput = Parameters<Raindrop["trackSignal"]>[0];

/** Minimal injected seam: production clients are Raindrop instances; tests need no network. */
export interface RaindropTelemetryClient {
  begin(input: BeginInput): { finish(input: FinishInput): Promise<void> };
  trackSignal(signal: SignalInput): ReturnType<Raindrop["trackSignal"]>;
}
type Interaction = ReturnType<RaindropTelemetryClient["begin"]>;

export interface DraftTelemetryContext {
  readonly eventId: string;
  readonly userId: string;
  readonly packName: string;
  readonly ruleIds: readonly string[];
}

function properties(context: DraftTelemetryContext): RaindropProperties {
  return { packName: context.packName, ruleIds: [...context.ruleIds] };
}

function outputText(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? "completed";
  } catch {
    return "completed";
  }
}

async function finishSafely(interaction: Interaction, output: string): Promise<void> {
  await interaction.finish({ output });
}

async function withInteraction<T>(
  client: RaindropTelemetryClient,
  context: DraftTelemetryContext,
  event: "exception_draft" | "rule_proposal",
  operation: () => Promise<T>,
): Promise<T> {
  const interaction = client.begin({
    eventId: context.eventId,
    event,
    userId: context.userId,
    properties: properties(context),
  });
  try {
    const result = await operation();
    await finishSafely(interaction, outputText(result));
    return result;
  } catch (error) {
    await finishSafely(interaction, "operation failed");
    throw error;
  }
}

/** Wrap an existing exception-drafting call without granting it any write capability. */
export function withExceptionDraftTelemetry<T>(
  client: RaindropTelemetryClient,
  context: DraftTelemetryContext,
  operation: () => Promise<T>,
): Promise<T> {
  return withInteraction(client, context, "exception_draft", operation);
}

/** Wrap an existing rule-proposal call without changing proposal authority. */
export function withRuleProposalTelemetry<T>(
  client: RaindropTelemetryClient,
  context: DraftTelemetryContext,
  operation: () => Promise<T>,
): Promise<T> {
  return withInteraction(client, context, "rule_proposal", operation);
}

function feedbackSignal(eventId: string, name: "thumbs_up" | "thumbs_down", comment?: string): SignalEvent {
  return {
    eventId,
    name,
    type: "feedback",
    sentiment: name === "thumbs_up" ? "POSITIVE" : "NEGATIVE",
    ...(comment === undefined ? {} : { comment }),
  };
}

/** Record a human approval against the originating telemetry event. */
export function trackHumanApproval(client: RaindropTelemetryClient, eventId: string): void {
  client.trackSignal(feedbackSignal(eventId, "thumbs_up"));
}

/** Record a human correction against the originating telemetry event. */
export function trackHumanCorrection(client: RaindropTelemetryClient, eventId: string, correctionText: string): void {
  client.trackSignal(feedbackSignal(eventId, "thumbs_down", correctionText));
}
