import { type ApiClient, createApiClient } from "@app/api-client";

// Browser code calls the API through the same-origin /api/* proxy, so the
// browser attaches the session cookie itself and receives every Set-Cookie.
export function getBrowserApiClient(): ApiClient {
  if (typeof window === "undefined") {
    throw new Error(
      "getBrowserApiClient() runs only in the browser. Use getApiClient() from @/lib/api on the server.",
    );
  }
  return createApiClient({ baseUrl: window.location.origin });
}
