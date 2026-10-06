import { createHash } from "node:crypto";

export const HASH_CHAIN_VERSION = 1 as const;
export const HASH_CHAIN_GENESIS = "0".repeat(64);

export type ChainJsonPrimitive = string | number | boolean | null;
export type ChainJsonValue = ChainJsonPrimitive | ChainJsonValue[] | { [key: string]: ChainJsonValue };

export interface HashChainEntry {
  readonly version: typeof HASH_CHAIN_VERSION;
  readonly index: number;
  readonly previousHash: string;
  readonly payload: ChainJsonValue;
  readonly hash: string;
}

export type HashChain = readonly HashChainEntry[];

export interface ChainExpectations {
  readonly expectedHead?: string;
  readonly expectedCount?: number;
}

export type ChainVerification =
  | { readonly valid: true; readonly head: string; readonly count: number }
  | { readonly valid: false; readonly index: number | null; readonly reason: string };

const HASH_PATTERN = /^[0-9a-f]{64}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneAndValidate(value: unknown): ChainJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("payload contains a non-finite number");
    return value;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      if (!(index in value)) throw new TypeError("payload contains a sparse array");
    }
    return value.map(cloneAndValidate);
  }
  if (!isPlainObject(value)) throw new TypeError("payload contains an unsupported value");
  const result: { [key: string]: ChainJsonValue } = {};
  for (const key of Object.keys(value)) result[key] = cloneAndValidate(value[key]);
  return result;
}

function canonicalJson(value: ChainJsonValue): string {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function hashEntry(index: number, previousHash: string, payload: ChainJsonValue): string {
  const encodedPayload = canonicalJson(payload);
  const frame = `ledger-hash-chain-entry:v${HASH_CHAIN_VERSION}\0${index}\0${previousHash.length}:${previousHash}\0${encodedPayload.length}:${encodedPayload}`;
  return createHash("sha256").update(frame, "utf8").digest("hex");
}

function failure(index: number | null, reason: string): ChainVerification {
  return { valid: false, index, reason };
}

/**
 * Append an entry without mutating the input chain or payload. The chain is
 * validated first, and the new hash binds version, position, previous hash,
 * and canonical JSON payload. The empty chain starts at HASH_CHAIN_GENESIS.
 */
export function appendHashChainEntry(chain: HashChain, payload: unknown): HashChain {
  const checked = verifyHashChain(chain);
  if (!checked.valid) throw new Error(`cannot append to invalid chain: ${checked.reason}`);
  const safePayload = cloneAndValidate(payload);
  const entry: HashChainEntry = {
    version: HASH_CHAIN_VERSION,
    index: checked.count,
    previousHash: checked.head,
    payload: safePayload,
    hash: hashEntry(checked.count, checked.head, safePayload)
  };
  return [...chain, entry];
}

/**
 * Verify a chain and optionally compare its trusted external head and count.
 * Empty chains are valid with head HASH_CHAIN_GENESIS and count zero. Failure
 * results contain an entry index when applicable and never include payloads.
 */
export function verifyHashChain(input: unknown, expectations: ChainExpectations = {}): ChainVerification {
  if (!Array.isArray(input)) return failure(null, "chain must be an array");
  if (expectations.expectedCount !== undefined && (!Number.isSafeInteger(expectations.expectedCount) || expectations.expectedCount < 0)) {
    return failure(null, "expected count must be a non-negative safe integer");
  }
  if (expectations.expectedHead !== undefined && !HASH_PATTERN.test(expectations.expectedHead)) {
    return failure(null, "expected head must be a SHA-256 hash");
  }

  let previousHash = HASH_CHAIN_GENESIS;
  for (let index = 0; index < input.length; index += 1) {
    const candidate = input[index];
    if (!isPlainObject(candidate)) return failure(index, "entry must be an object");
    const keys = Object.keys(candidate).sort();
    if (keys.join("|") !== "hash|index|payload|previousHash|version") return failure(index, "entry shape is invalid");
    if (candidate.version !== HASH_CHAIN_VERSION) return failure(index, "entry version is unsupported");
    if (candidate.index !== index) return failure(index, "entry sequence is invalid");
    if (typeof candidate.previousHash !== "string" || !HASH_PATTERN.test(candidate.previousHash)) return failure(index, "previous hash is invalid");
    if (candidate.previousHash !== previousHash) return failure(index, "previous hash link is invalid");
    if (typeof candidate.hash !== "string" || !HASH_PATTERN.test(candidate.hash)) return failure(index, "entry hash is invalid");

    let payload: ChainJsonValue;
    try {
      payload = cloneAndValidate(candidate.payload);
    } catch {
      return failure(index, "entry payload is not JSON-compatible");
    }
    if (hashEntry(index, previousHash, payload) !== candidate.hash) return failure(index, "entry hash does not match content");
    previousHash = candidate.hash;
  }

  const head = previousHash;
  if (expectations.expectedCount !== undefined && expectations.expectedCount !== input.length) return failure(input.length, "expected count does not match chain");
  if (expectations.expectedHead !== undefined && expectations.expectedHead !== head) return failure(input.length === 0 ? null : input.length - 1, "expected head does not match chain");
  return { valid: true, head, count: input.length };
}
