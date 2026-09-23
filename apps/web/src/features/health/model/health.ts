export type ApiHealthState = "healthy" | "unavailable";

export function normalizeHealthState(ok: boolean): ApiHealthState {
  return ok ? "healthy" : "unavailable";
}
