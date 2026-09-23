import type { ClientRequestOptions } from "@app/api-client";

const DEFAULT_INTERNAL_API_BASE_URL = "http://localhost:8000";

// Server code reaches the API over the internal network; browser code uses
// the generated client's default (the page origin).
export function apiRequestOptions(): ClientRequestOptions {
  if (typeof window === "undefined") {
    return {
      baseUrl:
        process.env.API_INTERNAL_BASE_URL ?? DEFAULT_INTERNAL_API_BASE_URL,
    };
  }
  return {};
}
