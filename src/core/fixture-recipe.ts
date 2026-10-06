import { createHash } from "node:crypto";
import { parseSyntheticRecords, type SyntheticRecord } from "./types.js";

export const FIXTURE_RECIPE = {
  datasetId: "ledger-neutral-prebuild-v1",
  generatorVersion: "neutral-records-generator-v1",
  seed: "ledger-a2-neutral-seed-v1",
  schemaVersion: 1 as const,
  generatedAt: "2026-10-06T00:00:00.000Z",
  referenceTimestamp: "2026-10-06T00:00:00.000Z",
  count: 12,
  workspaceId: "demo"
} as const;

const kinds = ["invoice", "rate_sheet", "service_log", "email"] as const;

function deterministicUuid(label: string): string {
  const hex = createHash("sha256").update(`${FIXTURE_RECIPE.seed}:${label}`, "utf8").digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20, 32).join("")}`;
}

export function generateSyntheticRecords(): SyntheticRecord[] {
  const reference = Date.parse(FIXTURE_RECIPE.referenceTimestamp);
  const records = Array.from({ length: FIXTURE_RECIPE.count }, (_, index) => {
    const ordinal = index + 1;
    const kind = kinds[index % kinds.length];
    return {
      id: deterministicUuid(`record:${ordinal}`),
      workspaceId: FIXTURE_RECIPE.workspaceId,
      schemaVersion: FIXTURE_RECIPE.schemaVersion,
      createdAt: new Date(reference - index * 6 * 60 * 60 * 1000).toISOString(),
      kind,
      customerId: deterministicUuid(`customer:${ordinal}`),
      source: "synthetic" as const,
      payload: {
        ordinal,
        token: `${kind}-sample-${String(ordinal).padStart(2, "0")}`,
        value: 1000 + ordinal * 37,
        lane: ["north", "east", "south", "west"][index % 4]
      }
    } satisfies SyntheticRecord;
  });
  return parseSyntheticRecords(records);
}
