import "server-only";

import { type ApiClient, createApiClient } from "@app/api-client";
import { headers } from "next/headers";

import { getApiInternalBaseUrl } from "@/lib/api-config";

type GetApiClientOptions = {
  /**
   * Sends the incoming request's cookies (the user's session) to the API.
   * Only valid while handling a request, never inside a cached scope.
   */
  forwardCookies?: boolean;
};

// Server code reaches the API directly over the internal network. Browser code
// uses getBrowserApiClient() from @/lib/browser-api, which goes through the proxy.
export function getApiClient({
  forwardCookies = false,
}: GetApiClientOptions = {}): ApiClient {
  const client = createApiClient({ baseUrl: getApiInternalBaseUrl() });
  if (forwardCookies) {
    client.use({
      async onRequest({ request }) {
        const cookie = (await headers()).get("cookie");
        if (cookie !== null) {
          request.headers.set("cookie", cookie);
        }
        return request;
      },
    });
  }
  return client;
}
