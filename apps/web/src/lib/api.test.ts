import { unwrap } from "@app/api-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getApiClient } from "./api";

const headersMock = vi.hoisted(() => vi.fn<() => Promise<Headers>>());

vi.mock("next/headers", () => ({ headers: headersMock }));

const fetchMock = vi.fn<(request: Request) => Promise<Response>>();

function sentRequest(): Request {
  const request = fetchMock.mock.calls[0]?.[0];
  if (request === undefined) {
    throw new Error("fetch was not called");
  }
  return request;
}

describe("getApiClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() =>
      Promise.resolve(Response.json({ status: "ok" })),
    );
    headersMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("API_INTERNAL_BASE_URL", "http://api.internal:8000");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("calls the API at the internal base URL", async () => {
    await unwrap(getApiClient().GET("/api/v1/health/live"));

    expect(sentRequest().url).toBe(
      "http://api.internal:8000/api/v1/health/live",
    );
  });

  it("does not read or send the incoming cookies by default", async () => {
    await unwrap(getApiClient().GET("/api/v1/health/live"));

    expect(headersMock).not.toHaveBeenCalled();
    expect(sentRequest().headers.has("cookie")).toBe(false);
  });

  it("forwards the incoming Cookie header when asked to", async () => {
    headersMock.mockResolvedValue(
      new Headers({ cookie: "montelingo_session=abc123; theme=dark" }),
    );

    await unwrap(
      getApiClient({ forwardCookies: true }).GET("/api/v1/health/live"),
    );

    expect(sentRequest().headers.get("cookie")).toBe(
      "montelingo_session=abc123; theme=dark",
    );
  });

  it("sends no Cookie header when the incoming request has none", async () => {
    headersMock.mockResolvedValue(new Headers());

    await unwrap(
      getApiClient({ forwardCookies: true }).GET("/api/v1/health/live"),
    );

    expect(sentRequest().headers.has("cookie")).toBe(false);
  });
});
