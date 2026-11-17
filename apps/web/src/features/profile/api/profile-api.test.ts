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

import { fetchProfile, getProfile, getProfileResult } from "./profile-api";

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

const ERROR = (code: string) => ({
  error: { code, message: "Something.", request_id: "req-1", details: null },
});

describe("fetchProfile", () => {
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
    expect(cacheMock).toHaveBeenCalledWith(fetchProfile);
    expect(getProfile).toBe(fetchProfile);
  });

  it("asks the API for the profile with the incoming cookies", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        name: "Mia",
        age_band: "5-6",
        avatar: "owl",
        is_complete: true,
      }),
    );

    await expect(fetchProfile()).resolves.toEqual({
      name: "Mia",
      ageBand: "5-6",
      avatar: "owl",
      isComplete: true,
    });
    expect(getApiClientMock).toHaveBeenCalledWith({ forwardCookies: true });
    expect(fetchMock.mock.calls[0]?.[0].url).toBe(
      "http://api.test/api/v1/profile",
    );
  });

  it("throws a 401, unlogged, so the caller can send the learner to sign in", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, ERROR("authentication_error")),
    );

    const result = fetchProfile();

    await expect(result).rejects.toBeInstanceOf(ApiClientError);
    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each([403, 500, 503])(
    "returns null and logs for any other failed status (%s)",
    async (status) => {
      fetchMock.mockResolvedValue(jsonResponse(status, ERROR("some_error")));

      await expect(fetchProfile()).resolves.toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        "profile_unavailable reason=%s request_id=%s",
        `status_${status}`,
        "req-1",
        expect.anything(),
      );
    },
  );

  it("returns null when the API cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(fetchProfile()).resolves.toBeNull();
  });

  it("returns null for a buddy outside the contract", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        name: "Mia",
        age_band: "5-6",
        avatar: "dragon",
        is_complete: true,
      }),
    );

    await expect(fetchProfile()).resolves.toBeNull();
  });

  it("rethrows Next.js signals", async () => {
    const signal = new DynamicServerError("cookies");
    getApiClientMock.mockImplementation(() => {
      throw signal;
    });

    await expect(fetchProfile()).rejects.toBe(signal);
  });
});

describe("getProfileResult", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getApiClientMock.mockReset();
    getApiClientMock.mockImplementation(() =>
      createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("is ready with the profile", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        name: "Mia",
        age_band: "5-6",
        avatar: "owl",
        is_complete: true,
      }),
    );

    await expect(getProfileResult()).resolves.toEqual({
      status: "ready",
      profile: { name: "Mia", ageBand: "5-6", avatar: "owl", isComplete: true },
    });
  });

  it("is signed out for a 401, instead of throwing", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, ERROR("authentication_error")),
    );

    await expect(getProfileResult()).resolves.toEqual({ status: "signed-out" });
  });

  it("is unavailable for any other failure", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(500, ERROR("internal_server_error")),
    );

    await expect(getProfileResult()).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("rethrows Next.js signals", async () => {
    const signal = new DynamicServerError("cookies");
    getApiClientMock.mockImplementation(() => {
      throw signal;
    });

    await expect(getProfileResult()).rejects.toBe(signal);
  });
});
