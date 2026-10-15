import { unwrap } from "@app/api-client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getBrowserApiClient } from "./browser-api";

describe("getBrowserApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the API through the page origin", async () => {
    const fetchMock = vi.fn<(request: Request) => Promise<Response>>(() =>
      Promise.resolve(Response.json({ status: "ok" })),
    );
    vi.stubGlobal("window", { location: { origin: "https://web.test" } });
    vi.stubGlobal("fetch", fetchMock);

    await unwrap(getBrowserApiClient().GET("/api/v1/health/live"));

    expect(fetchMock.mock.calls[0]?.[0].url).toBe(
      "https://web.test/api/v1/health/live",
    );
  });

  it("sends only the page origin as Referer, never the page's path or query", async () => {
    const fetchMock = vi.fn<(request: Request) => Promise<Response>>(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("window", { location: { origin: "https://web.test" } });
    vi.stubGlobal("fetch", fetchMock);

    await unwrap(
      getBrowserApiClient().POST("/api/v1/auth/password-reset/confirm", {
        body: { token: "reset-token-123", new_password: "new secret" },
      }),
    );

    expect(fetchMock.mock.calls[0]?.[0].referrerPolicy).toBe("strict-origin");
  });

  it("refuses to run on the server", () => {
    expect(() => getBrowserApiClient()).toThrow(/runs only in the browser/);
  });
});
