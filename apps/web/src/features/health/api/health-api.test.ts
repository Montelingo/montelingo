import { createApiClient } from "@app/api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getApiHealthState } from "./health-api";

const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);

vi.mock("@/lib/api", () => ({
  getApiClient: () =>
    createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("getApiHealthState", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns healthy when the API reports ok", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { status: "ok" }));

    await expect(getApiHealthState()).resolves.toBe("healthy");
    expect(fetchMock.mock.calls[0]?.[0].url).toBe(
      "http://api.test/api/v1/health/live",
    );
  });

  it("returns unavailable when the API responds with an error envelope", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(500, {
        error: {
          code: "internal_server_error",
          message: "An unexpected error occurred.",
          request_id: "req-1",
          details: null,
        },
      }),
    );

    await expect(getApiHealthState()).resolves.toBe("unavailable");
  });

  it("returns unavailable when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("connection refused"));

    await expect(getApiHealthState()).resolves.toBe("unavailable");
  });
});
