import { createHash } from "node:crypto";
import { parseUuid } from "../ids.js";
import { reconCaseSchema, reconRecordSchema, type ReconCase, type ReconPack, type ReconRecord } from "./record-types.js";

export interface MatchOptions<T extends ReconRecord = ReconRecord> {
  readonly pack: ReconPack;
  readonly keyFor: (record: T) => string;
  readonly caseIdFor?: (workspaceId: string, pack: ReconPack, key: string, records: readonly T[]) => string;
}

function defaultCaseId(workspaceId: string, pack: ReconPack, key: string): string {
  const digest = createHash("sha256").update(`ledger-recon-case:v1\0${workspaceId}\0${pack}\0${key}`, "utf8").digest("hex");
  const bytes = digest.slice(0, 32).split("");
  bytes[12] = "5";
  bytes[16] = ((Number.parseInt(bytes[16], 16) & 0x3) | 0x8).toString(16);
  return parseUuid(`${bytes.slice(0, 8).join("")}-${bytes.slice(8, 12).join("")}-${bytes.slice(12, 16).join("")}-${bytes.slice(16, 20).join("")}-${bytes.slice(20).join("")}`);
}

/** Group validated records by workspace and a pack-specific deterministic key. */
export function matchRecords<T extends ReconRecord>(records: readonly T[], options: MatchOptions<T>): ReconCase[] {
  const groups = new Map<string, { readonly workspaceId: string; readonly key: string; readonly records: T[] }>();
  const seen = new Set<string>();
  for (const input of records) {
    const record = reconRecordSchema.parse(input) as T;
    if (seen.has(record.recordId)) throw new Error(`duplicate reconciliation record id: ${record.recordId}`);
    seen.add(record.recordId);
    const key = options.keyFor(record);
    if (key.trim() === "") throw new Error("reconciliation match key must be nonempty");
    const groupKey = JSON.stringify([record.workspaceId, key]);
    const group = groups.get(groupKey);
    if (group) group.records.push(record);
    else groups.set(groupKey, { workspaceId: record.workspaceId, key, records: [record] });
  }
  return [...groups.values()].map((group) => reconCaseSchema.parse({
    caseId: parseUuid(options.caseIdFor?.(group.workspaceId, options.pack, group.key, group.records) ?? defaultCaseId(group.workspaceId, options.pack, group.key)),
    workspaceId: group.workspaceId,
    pack: options.pack,
    key: group.key,
    recordIds: group.records.map((record) => record.recordId),
    status: "open"
  }));
}
