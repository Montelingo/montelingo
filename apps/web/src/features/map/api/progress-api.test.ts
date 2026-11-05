import {
  type ApiClient,
  ApiClientError,
  createApiClient,
} from "@app/api-client";
// What cookies() throws while Next.js prerenders a route, to mark it dynamic.
// Imported from Next.js's internals because the error is not public API.
import { DynamicServerError } from "next/dist/client/components/hooks-server-context";
import type * as React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import { fetchProgress, getProgress } from "./progress-api";

const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);

const getApiClientMock = vi.hoisted(() =>
  vi.fn<(options?: { forwardCookies?: boolean }) => ApiClient>(),
);

// Tests load React's non-server build, whose cache() never memoizes. Recording
// what it wraps is enough to check that the adapter is cached.
const cacheMock = vi.hoisted(() =>
  vi.fn(<Fn extends (...args: never[]) => unknown>(fn: Fn) => fn),
);

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  cache: cacheMock,
}));

vi.mock("@/lib/api", () => ({ getApiClient: getApiClientMock }));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchProgress", () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    fetchMock.mockReset();
    getApiClientMock.mockReset();
    getApiClientMock.mockImplementation(() =>
      createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
    );
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("is wrapped in React cache()", () => {
    expect(cacheMock).toHaveBeenCalledWith(fetchProgress);
    expect(getProgress).toBe(fetchProgress);
  });

  it("asks the API for progress with the incoming cookies", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { regions: [], locations: [] }),
    );

    await fetchProgress();

    expect(getApiClientMock).toHaveBeenCalledWith({ forwardCookies: true });
    expect(fetchMock.mock.calls[0]?.[0].url).toBe(
      "http://api.test/api/v1/progress",
    );
  });

  it("returns the states the server decided", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        regions: [{ id: "coast", state: "available" }],
        locations: [
          { id: "budva", state: "available" },
          { id: "kotor", state: "locked" },
        ],
      }),
    );

    await expect(fetchProgress()).resolves.toEqual({
      status: "ready",
      progress: {
        regions: [{ id: "coast", state: "available" }],
        locations: [
          { id: "budva", state: "available" },
          { id: "kotor", state: "locked" },
        ],
      },
    });
  });

  it("returns an error result and logs when the API fails", async () => {
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

    await expect(fetchProgress()).resolves.toEqual({ status: "error" });
    expect(consoleError).toHaveBeenCalledWith(
      "map_progress_unavailable reason=%s request_id=%s",
      "status_500",
      "req-1",
      expect.anything(),
    );
  });

  it("throws a 401, unlogged, so the loaders can send the learner to sign in", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, {
        error: {
          code: "authentication_error",
          message: "Authentication required.",
          request_id: "req-1",
          details: null,
        },
      }),
    );

    const result = fetchProgress();

    await expect(result).rejects.toBeInstanceOf(ApiClientError);
    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each([403, 404, 500, 503])(
    "returns an error result for any other failed status (%s)",
    async (status) => {
      fetchMock.mockResolvedValue(
        jsonResponse(status, {
          error: {
            code: "some_error",
            message: "Something went wrong.",
            request_id: "req-1",
            details: null,
          },
        }),
      );

      await expect(fetchProgress()).resolves.toEqual({ status: "error" });
    },
  );

  it("returns an error result when the API cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(fetchProgress()).resolves.toEqual({ status: "error" });
    expect(consoleError).toHaveBeenCalledWith(
      expect.any(String),
      "unreachable",
      "-",
      expect.anything(),
    );
  });

  it("returns an error result for a state outside the contract", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        regions: [],
        locations: [{ id: "budva", state: "unlocked" }],
      }),
    );

    await expect(fetchProgress()).resolves.toEqual({ status: "error" });
  });

  it("does not let the server send a frontend-only state", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        regions: [],
        locations: [{ id: "budva", state: "active" }],
      }),
    );

    await expect(fetchProgress()).resolves.toEqual({ status: "error" });
  });

  it("rethrows Next.js signals", async () => {
    const signal = new DynamicServerError("cookies");
    getApiClientMock.mockImplementation(() => {
      throw signal;
    });

    await expect(fetchProgress()).rejects.toBe(signal);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
