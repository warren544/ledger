/**
 * Generic capability names use exact lowercase dotted segments such as
 * `sample.read`. This module defines no product capabilities or actions.
 */
const CAPABILITY_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;

export type CapabilityDecision =
  | { readonly allowed: true; readonly capability: string; readonly reason: "allowlisted" }
  | { readonly allowed: false; readonly capability: string | null; readonly reason: "invalid-name" | "not-allowlisted" };

export interface CapabilityGate {
  decide(candidate: unknown): CapabilityDecision;
}

function isCapabilityName(value: unknown): value is string {
  return typeof value === "string" && CAPABILITY_PATTERN.test(value);
}

/**
 * Construct an immutable default-deny gate at a trusted application boundary.
 * The allowlist is copied immediately; later caller mutation cannot widen it.
 * This gate is not model-writable and has no grant, update, callback, or tool
 * execution API.
 */
export function createCapabilityGate(allowlist: readonly string[]): CapabilityGate {
  if (!Array.isArray(allowlist)) throw new TypeError("capability allowlist must be an array");
  if (allowlist.some((capability) => !isCapabilityName(capability))) {
    throw new TypeError("capability allowlist contains a malformed name");
  }
  const allowed = new Set(allowlist);

  return Object.freeze({
    decide(candidate: unknown): CapabilityDecision {
      if (!isCapabilityName(candidate)) {
        return { allowed: false, capability: typeof candidate === "string" ? candidate : null, reason: "invalid-name" };
      }
      if (!allowed.has(candidate)) return { allowed: false, capability: candidate, reason: "not-allowlisted" };
      return { allowed: true, capability: candidate, reason: "allowlisted" };
    }
  });
}
