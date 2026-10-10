import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const fetchMock = vi.fn<typeof fetch>();

describe("/api/[...path] route", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(() =>
      Promise.resolve(Response.json({ status: "ok" })),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("resolves API_INTERNAL_BASE_URL on every request", async () => {
    vi.stubEnv("API_INTERNAL_BASE_URL", "http://api-a:8000");
    await GET(new Request("http://web.test/api/v1/health/live"));

    vi.stubEnv("API_INTERNAL_BASE_URL", "http://api-b:9000");
    await GET(new Request("http://web.test/api/v1/health/live"));

    expect(fetchMock.mock.calls[0]?.[0]).toHaveProperty(
      "href",
      "http://api-a:8000/api/v1/health/live",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toHaveProperty(
      "href",
      "http://api-b:9000/api/v1/health/live",
    );
  });
});
