"use client";

export interface DemoSession {
  readonly token: string;
  readonly actor: { readonly role: "agent" | "demo_operator" | "human_approver"; readonly workspaceId: string };
}

const storageKey = "ledger.demo.session";

export function getDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try { const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "null"); return value && typeof value === "object" && "token" in value ? value as DemoSession : null; } catch { return null; }
}

export function setDemoSession(value: DemoSession): void { window.localStorage.setItem(storageKey, JSON.stringify(value)); }
export function clearDemoSession(): void { window.localStorage.removeItem(storageKey); }

export function sessionHeaders(): HeadersInit {
  const session = getDemoSession();
  return session ? { "x-ledger-demo-session": session.token } : {};
}
