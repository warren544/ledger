export const REDACTION_MARKERS = {
  value: "[REDACTED]",
  cycle: "[REDACTED_CYCLE]",
  depth: "[REDACTED_DEPTH]",
  limit: "[REDACTED_LIMIT]",
  unsupported: "[REDACTED_UNSUPPORTED]",
  mongoUri: "[REDACTED_MONGODB_URI]"
} as const;

export type RedactedValue = string | number | boolean | null | RedactedValue[] | { [key: string]: RedactedValue };

export interface RedactionOptions {
  readonly secrets?: readonly string[];
  readonly maxDepth?: number;
  readonly maxEntries?: number;
}

const SENSITIVE_KEYS = new Set([
  "api_key",
  "apikey",
  "authorization",
  "client_secret",
  "connection_string",
  "connectionstring",
  "cookie",
  "mongo_uri",
  "mongodb_uri",
  "password",
  "private_key",
  "proxy_authorization",
  "refresh_token",
  "secret",
  "token",
  "x_api_key"
]);

const MONGO_CREDENTIAL_PATTERN = /mongodb(?:\+srv)?:\/\/[^@\s/"']+@/gi;
const AUTHORIZATION_VALUE_PATTERN = /\b(?:Bearer|Basic)\s+[^\s,;]+/gi;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s-]+/g, "_");
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return SENSITIVE_KEYS.has(normalized) || normalized.endsWith("_api_key") || normalized.endsWith("_token") || normalized.endsWith("_password");
}

function redactString(value: string, secrets: readonly string[]): string {
  let result = value;
  for (const secret of secrets) result = result.split(secret).join(REDACTION_MARKERS.value);
  result = result.replace(MONGO_CREDENTIAL_PATTERN, (match) => {
    const scheme = match.toLowerCase().startsWith("mongodb+srv://") ? "mongodb+srv://" : "mongodb://";
    return `${scheme}${REDACTION_MARKERS.value}@`;
  });
  return result.replace(AUTHORIZATION_VALUE_PATTERN, (match) => `${match.split(/\s+/, 1)[0]} ${REDACTION_MARKERS.value}`);
}

function readBound(value: number | undefined, name: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative safe integer`);
  return value;
}

/**
 * Recursively redact structured values without mutating them. Exact sensitive
 * keys and caller-supplied nonempty secret values are reliable protections.
 * String regexes cover common Mongo credential and Authorization forms only;
 * this is not universal PII or secret discovery.
 *
 * Traversal is bounded by depth and visited-value limits. Cycles, unsupported
 * values, errors, and limits become explicit markers; raw values are never
 * stringified as a fallback.
 */
export function redact(value: unknown, options: RedactionOptions = {}): RedactedValue {
  if (options.secrets !== undefined && !Array.isArray(options.secrets)) throw new TypeError("secrets must be an array");
  const secrets = [...(options.secrets ?? [])];
  if (secrets.some((secret) => typeof secret !== "string" || secret.length === 0)) throw new TypeError("secrets must contain nonempty strings");
  const sortedSecrets = secrets.sort((left, right) => right.length - left.length);
  const maxDepth = readBound(options.maxDepth, "maxDepth", 8);
  const maxEntries = readBound(options.maxEntries, "maxEntries", 1000);
  const active = new WeakSet<object>();
  let entries = 0;

  function visit(input: unknown, depth: number, key?: string): RedactedValue {
    if (key !== undefined && isSensitiveKey(key)) return REDACTION_MARKERS.value;
    if (depth > maxDepth) return REDACTION_MARKERS.depth;
    if (entries >= maxEntries) return REDACTION_MARKERS.limit;
    entries += 1;
    if (typeof input === "string") return redactString(input, sortedSecrets);
    if (input === null || typeof input === "boolean" || typeof input === "number") {
      return typeof input === "number" && !Number.isFinite(input) ? REDACTION_MARKERS.unsupported : input;
    }

    if (input instanceof Error) {
      return {
        name: redactString(input.name, sortedSecrets),
        message: redactString(input.message, sortedSecrets),
        stack: input.stack === undefined ? REDACTION_MARKERS.unsupported : redactString(input.stack, sortedSecrets)
      };
    }
    if (typeof input !== "object" || input === null || (Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null && !Array.isArray(input))) {
      return REDACTION_MARKERS.unsupported;
    }
    if (active.has(input)) return REDACTION_MARKERS.cycle;
    active.add(input);
    try {
      if (Array.isArray(input)) return input.map((item) => visit(item, depth + 1));
      const output: { [key: string]: RedactedValue } = {};
      for (const [childKey, childValue] of Object.entries(input)) output[childKey] = visit(childValue, depth + 1, childKey);
      return output;
    } finally {
      active.delete(input);
    }
  }

  return visit(value, 0);
}
