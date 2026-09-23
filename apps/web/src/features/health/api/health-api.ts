import { live_api_v1_health_live_get } from "@app/api-client";

import { apiRequestOptions } from "@/lib/api";

import { type ApiHealthState, normalizeHealthState } from "../model/health";

export async function getApiHealthState(): Promise<ApiHealthState> {
  try {
    const body = await live_api_v1_health_live_get(apiRequestOptions());
    return normalizeHealthState(body.status === "ok");
  } catch {
    return "unavailable";
  }
}
