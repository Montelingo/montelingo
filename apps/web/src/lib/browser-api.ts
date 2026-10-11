import { type ApiClient, createApiClient } from "@app/api-client";

// Browser code calls the API through the same-origin /api/* proxy, so the
// browser attaches the session cookie itself and receives every Set-Cookie.
//
// API calls send only the page's origin as Referer, never its path or query: a
// page URL can hold a secret (the reset-password token). The policy is set here
// rather than left to the document, because /reset-password's `no-referrer`
// outlives client-side navigations, and under it older browsers may send
// `Origin: null`, which the API's CSRF check (ADR 0004) rejects.
export function getBrowserApiClient(): ApiClient {
  if (typeof window === "undefined") {
    throw new Error(
      "getBrowserApiClient() runs only in the browser. Use getApiClient() from @/lib/api on the server.",
    );
  }
  return createApiClient({
    baseUrl: window.location.origin,
    referrerPolicy: "strict-origin",
  });
}
