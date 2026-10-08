import {
  type ApiClient,
  ApiClientError,
  ApiNetworkError,
  createApiClient,
  type Schemas,
} from "@app/api-client";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchCurrentUser, getCurrentUser } from "./session";

const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);

const getApiClientMock = vi.hoisted(() =>
  vi.fn<(options?: { forwardCookies?: boolean }) => ApiClient>(),
);

// Tests load React's non-server build, whose cache() only forwards each call
// and never memoizes (memoizing happens inside a server render). This stand-in
// memoizes the first call, so the test can observe that getCurrentUser is
// fetchCurrentUser wrapped in cache(). It does not prove per-request scoping.
const cacheMock = vi.hoisted(() =>
  vi.fn(<Args extends unknown[], Result>(fn: (...args: Args) => Result) => {
    let cached: { result: Result } | undefined;
    return (...args: Args): Result => {
      cached ??= { result: fn(...args) };
      return cached.result;
    };
  }),
);

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  cache: cacheMock,
}));

vi.mock("@/lib/api", () => ({ getApiClient: getApiClientMock }));

const cookiesMock = vi.hoisted(() =>
  vi.fn<() => Promise<{ has: (name: string) => boolean }>>(),
);

vi.mock("next/headers", () => ({ cookies: cookiesMock }));

function withCookies(...names: string[]) {
  cookiesMock.mockResolvedValue({ has: (name) => names.includes(name) });
}

function makeUserResource(
  overrides: Partial<Schemas["CurrentUser"]> = {},
): Schemas["CurrentUser"] {
  return {
    id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
    email: "ana@example.com",
    created_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse(status, {
    error: { code, message: "API message", request_id: "req-1", details: null },
  });
}

function sentRequest(): Request {
  const request = fetchMock.mock.calls[0]?.[0];
  if (request === undefined) {
    throw new Error("fetch was not called");
  }
  return request;
}

describe("fetchCurrentUser", () => {
  beforeEach(() => {
    withCookies("montelingo_session");
    fetchMock.mockReset();
    getApiClientMock.mockReset();
    getApiClientMock.mockImplementation(() =>
      createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
    );
  });

  it("asks the API for the current user with the incoming cookies", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, makeUserResource()));

    await fetchCurrentUser();

    expect(getApiClientMock).toHaveBeenCalledWith({ forwardCookies: true });
    expect(sentRequest().method).toBe("GET");
    expect(sentRequest().url).toBe("http://api.test/api/v1/auth/me");
  });

  it("returns the signed-in user", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, makeUserResource()));

    await expect(fetchCurrentUser()).resolves.toEqual({
      id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
      email: "ana@example.com",
      createdAt: "2026-09-01T10:00:00Z",
    });
  });

  it("returns null when there is no valid session (401)", async () => {
    fetchMock.mockResolvedValue(errorResponse(401, "authentication_error"));

    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  it("rethrows other API errors", async () => {
    fetchMock.mockResolvedValue(errorResponse(500, "internal_server_error"));

    const error: unknown = await fetchCurrentUser().catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 500,
      error: { error: { code: "internal_server_error" } },
    });
  });

  it("rethrows a network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(fetchCurrentUser()).rejects.toBeInstanceOf(ApiNetworkError);
  });

  it("returns null without calling the API when there is no session cookie", async () => {
    withCookies("theme");

    await expect(fetchCurrentUser()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getCurrentUser", () => {
  beforeEach(() => {
    withCookies("montelingo_session");
    fetchMock.mockReset();
    getApiClientMock.mockImplementation(() =>
      createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
    );
  });

  it("is fetchCurrentUser wrapped in React cache()", () => {
    expect(cacheMock).toHaveBeenCalledWith(fetchCurrentUser);
    expect(getCurrentUser).toBe(cacheMock.mock.results[0]?.value);
  });

  it("shares one API call between callers within the cache", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(200, makeUserResource())),
    );

    const [first, second] = await Promise.all([
      getCurrentUser(),
      getCurrentUser(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual({
      id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
      email: "ana@example.com",
      createdAt: "2026-09-01T10:00:00Z",
    });
    expect(second).toBe(first);
  });
});
