"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { sessionHeaders } from "../_lib/session";
import { classifyApiState } from "../_lib/ui-state";
import { StateMessage } from "../_components/state-message";

interface CaseSummary { readonly caseId: string; readonly pack: string; readonly status: string; readonly key: string }

export default function CasesPage() {
  const [cases, setCases] = useState<CaseSummary[]>([]); const [status, setStatus] = useState<number>(); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  useEffect(() => { void (async () => { try { const response = await fetch("/api/cases", { headers: sessionHeaders() }); setStatus(response.status); if (!response.ok) throw new Error("request failed"); const value: unknown = await response.json(); if (!Array.isArray(value)) throw new Error("validation"); setCases(value as CaseSummary[]); } catch { setError(true); } finally { setLoading(false); } })(); }, []);
  const state = classifyApiState({ loading, status, itemCount: cases.length, validationError: !loading && !error && status === 200 && !Array.isArray(cases) });
  return <main className="page"><div className="page-heading"><div><span className="eyebrow">P1 / P5 flow</span><h1>Exception queue</h1><p>Workspace-scoped synthetic cases from the server API.</p></div></div>{state === "loading" && <StateMessage>Loading cases…</StateMessage>}{state === "denied" && <StateMessage tone="danger">Access denied or unauthenticated. Select a signed demo actor above.</StateMessage>}{state === "network-error" && <StateMessage tone="danger">The cases request failed. Check the server and Atlas configuration.</StateMessage>}{state === "empty" && <StateMessage>No cases are available in this workspace.</StateMessage>}{state === "ready" && <div className="card-list">{cases.map((item) => <Link className="card" href={`/cases/${item.caseId}`} key={item.caseId}><strong>{item.pack} · {item.key}</strong><span>{item.status} · {item.caseId}</span></Link>)}</div>}{error && state !== "denied" && state !== "network-error" && <StateMessage tone="danger">The server returned an invalid response.</StateMessage>}</main>;
}
