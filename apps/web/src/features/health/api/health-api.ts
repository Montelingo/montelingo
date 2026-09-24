import { unwrap } from "@app/api-client";

import { getApiClient } from "@/lib/api";

import { type ApiHealthState, normalizeHealthState } from "../model/health";

export async function getApiHealthState(): Promise<ApiHealthState> {
  try {
    const body = await unwrap(getApiClient().GET("/api/v1/health/live"));
    return normalizeHealthState(body.status === "ok");
  } catch {
    return "unavailable";
  }
}
