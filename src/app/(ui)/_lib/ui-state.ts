export type ApiState = "loading" | "ready" | "empty" | "denied" | "validation-error" | "network-error";

export function classifyApiState(input: { readonly loading: boolean; readonly status?: number; readonly itemCount?: number; readonly validationError?: boolean }): ApiState {
  if (input.loading) return "loading";
  if (input.status === 401 || input.status === 403) return "denied";
  if (input.validationError) return "validation-error";
  if (input.status !== undefined && (input.status < 200 || input.status >= 300)) return "network-error";
  return input.itemCount === 0 ? "empty" : "ready";
}

export function chainBadgeState(input: { readonly loaded: boolean; readonly requestFailed: boolean; readonly valid?: boolean }): "unknown" | "verified" | "invalid" | "unavailable" {
  if (!input.loaded) return "unknown";
  if (input.requestFailed) return "unavailable";
  return input.valid === true ? "verified" : "invalid";
}
