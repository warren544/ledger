import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { parseUuid } from "../../core/ids.js";
import { createCapabilityGate, type CapabilityDecision } from "../../core/capabilities.js";

export const RECON_CAPABILITIES = [
  "records.read", "records.ingest", "case.run", "exception.draft", "correction.write", "rule.propose", "rule.evaluate", "rule.approve", "rule.rollback", "audit.read"
] as const;
export type ReconCapability = typeof RECON_CAPABILITIES[number];
export type ReconActorRole = "agent" | "demo_operator" | "human_approver";

export interface ReconActor {
  readonly actorId: string;
  readonly workspaceId: string;
  readonly role: ReconActorRole;
  readonly sessionId: string;
}

const roleCapabilities: Record<ReconActorRole, readonly ReconCapability[]> = {
  agent: ["records.read", "case.run", "exception.draft", "rule.propose"],
  demo_operator: ["records.read", "records.ingest", "correction.write", "rule.evaluate"],
  human_approver: ["records.read", "audit.read", "rule.approve", "rule.rollback"]
};

export const DEMO_ACTORS = Object.freeze({
  agent: "550e8400-e29b-41d4-a716-446655440201",
  demo_operator: "550e8400-e29b-41d4-a716-446655440202",
  human_approver: "550e8400-e29b-41d4-a716-446655440203"
} as const);

interface SessionPayload {
  readonly actorId: string;
  readonly workspaceId: string;
  readonly role: ReconActorRole;
  readonly sessionId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input, "utf8").digest("base64url");
}

function secretValue(secret: string): string {
  if (secret.trim() === "") throw new Error("demo session secret is required");
  return secret;
}

/** Issue a short-lived signed demo session. Production authentication is deferred. */
export function issueDemoSession(role: ReconActorRole, workspaceId: string, secret: string, now = Date.now(), ttlMs = 3_600_000): string {
  parseUuid(DEMO_ACTORS[role]);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(workspaceId)) throw new Error("invalid session workspace");
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs < 1) throw new Error("invalid session lifetime");
  const payload: SessionPayload = { actorId: DEMO_ACTORS[role], workspaceId, role, sessionId: randomUUID(), issuedAt: now, expiresAt: now + ttlMs };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${signature(encoded, secretValue(secret))}`;
}

export function verifyDemoSession(token: string, secret: string, now = Date.now()): ReconActor {
  const [encoded, provided] = token.split(".");
  if (!encoded || !provided) throw new Error("invalid demo session");
  const expected = signature(encoded, secretValue(secret));
  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");
  if (expectedBytes.length !== providedBytes.length || !timingSafeEqual(expectedBytes, providedBytes)) throw new Error("invalid demo session");
  let payload: SessionPayload;
  try { payload = JSON.parse(decode(encoded)) as SessionPayload; } catch { throw new Error("invalid demo session"); }
  if (!payload || typeof payload !== "object" || !parseUuid(payload.actorId) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(payload.workspaceId) || !roleCapabilities[payload.role] || typeof payload.sessionId !== "string" || payload.expiresAt <= now) throw new Error("invalid demo session");
  if (DEMO_ACTORS[payload.role] !== payload.actorId) throw new Error("invalid demo actor");
  return { actorId: payload.actorId, workspaceId: payload.workspaceId, role: payload.role, sessionId: payload.sessionId };
}

export function authorize(actor: ReconActor, capability: ReconCapability): CapabilityDecision {
  return createCapabilityGate(roleCapabilities[actor.role]).decide(capability);
}

export function actorFromRequest(request: Request): ReconActor {
  const token = request.headers.get("x-ledger-demo-session");
  const secret = process.env.LEDGER_DEMO_SESSION_SECRET;
  if (!token || !secret) throw new Error("authentication required");
  return verifyDemoSession(token, secret);
}

export function requireCapability(actor: ReconActor, capability: ReconCapability): void {
  if (!authorize(actor, capability).allowed) throw new Error("capability denied");
}
