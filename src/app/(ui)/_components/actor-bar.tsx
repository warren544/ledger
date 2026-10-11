"use client";

import { useEffect, useState } from "react";
import { clearDemoSession, getDemoSession, setDemoSession, type DemoSession } from "../_lib/session";

const roles = ["agent", "demo_operator", "human_approver"] as const;

export function ActorBar() {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => setSession(getDemoSession()), []);
  async function selectRole(role: DemoSession["actor"]["role"]) {
    setMessage("Signing demo session…");
    try {
      const response = await fetch("/api/demo/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role, workspaceId: "demo" }) });
      const value: unknown = await response.json();
      if (!response.ok || !value || typeof value !== "object" || !("token" in value)) throw new Error(response.status === 403 ? "denied" : "session unavailable");
      const next = value as DemoSession;
      setDemoSession(next); setSession(next); setMessage("Signed demo session ready");
    } catch (error) { setMessage(error instanceof Error ? error.message : "session unavailable"); }
  }
  return <section className="actor-bar" aria-label="Demo actor session"><div><strong>Signed demo actor</strong><span>{session ? `${session.actor.role} · ${session.actor.workspaceId}` : "none selected"}</span><small>Production authentication is deferred.</small></div><div className="actor-actions">{roles.map((role) => <button key={role} type="button" onClick={() => void selectRole(role)}>{role}</button>)}{session && <button type="button" onClick={() => { clearDemoSession(); setSession(null); setMessage("Session cleared"); }}>clear</button>}</div>{message && <small role="status">{message}</small>}</section>;
}
