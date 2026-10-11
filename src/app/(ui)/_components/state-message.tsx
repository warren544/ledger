import type { ReactNode } from "react";

export function StateMessage({ children, tone = "neutral" }: { readonly children: ReactNode; readonly tone?: "neutral" | "danger" | "success" }) {
  return <p className={`state state-${tone}`} role="status">{children}</p>;
}
