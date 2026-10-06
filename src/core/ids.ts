import { randomUUID } from "node:crypto";

/** A validated UUID string used for runtime identifiers. */
export type UUID = string & { readonly __brand: "UUID" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Return whether a value is a syntactically valid RFC 4122 UUID string. */
export function isUuid(value: unknown): value is UUID {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Validate and brand a UUID string. */
export function parseUuid(value: string): UUID {
  if (!isUuid(value)) throw new TypeError("invalid UUID");
  return value as UUID;
}

/**
 * Create an ID generator with an injectable source for deterministic tests.
 * Every generated value is validated; no mutable counter or module state is
 * used. The default source is Node's cryptographically random UUID generator.
 */
export function createIdGenerator(source: () => string = randomUUID): () => UUID {
  return () => parseUuid(source());
}
