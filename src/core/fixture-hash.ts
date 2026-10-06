import { createHash } from "node:crypto";
import type { SyntheticRecord } from "./types.js";

export function deterministicJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(deterministicJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${deterministicJson(object[key])}`).join(",")}}`;
}

export function serializeRecords(records: SyntheticRecord[]): string {
  return deterministicJson(records);
}

export function hashRecords(records: SyntheticRecord[]): string {
  return createHash("sha256").update(Buffer.from(serializeRecords(records), "utf8")).digest("hex");
}
