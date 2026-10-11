import Link from "next/link";
import type { ReactNode } from "react";
import { ActorBar } from "./_components/actor-bar";

export default function UiLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="ui-shell">
      <header className="ui-header">
        <div><Link href="/cases" className="brand">Ledger reconciliation</Link><span className="eyebrow">synthetic demo</span></div>
        <nav aria-label="Primary"><Link href="/cases">Cases</Link><Link href="/rules">Rules</Link><Link href="/replay">Replay</Link></nav>
      </header>
      <ActorBar />
      {children}
    </div>
  );
}
