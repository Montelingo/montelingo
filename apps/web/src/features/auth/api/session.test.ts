import {
  type ApiClient,
  ApiClientError,
  ApiNetworkError,
  createApiClient,
  type Schemas,
} from "@app/api-client";
// What cookies() throws while Next.js prerenders a route, to mark it dynamic.
// Imported from Next.js's internals because the error is not public API.
import { DynamicServerError } from "next/dist/client/components/hooks-server-context";
import { redirect } from "next/navigation";
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

import {
  CURRENT_USER_TIMEOUT_MS,
  fetchCurrentUser,
  getAuthState,
  getCurrentUser,
  resolveAuthState,
} from "./session";

const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);

const getApiClientMock = vi.hoisted(() =>
  vi.fn<(options?: { forwardCookies?: boolean }) => ApiClient>(),
);

// Tests load React's non-server build, whose cache() only forwards each call
// and never memoizes (memoizing happens inside a server render). This stand-in
// memoizes the first call until resetCaches() runs (the start of a "request"),
// so the test can observe what is wrapped in cache() and what shares a call.
// It does not prove per-request scoping.
const { cacheMock, resetCaches } = vi.hoisted(() => {
  const resetters: (() => void)[] = [];
  return {
    cacheMock: vi.fn(
      <Args extends unknown[], Result>(fn: (...args: Args) => Result) => {
        let cached: { result: Result } | undefined;
        resetters.push(() => {
          cached = undefined;
        });
        return (...args: Args): Result => {
          cached ??= { result: fn(...args) };
          return cached.result;
        };
      },
    ),
    resetCaches: () => {
      for (const reset of resetters) {
        reset();
      }
    },
  };
});

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

  it("gives up when the API does not answer in time", async () => {
    const timeout = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeout.signal);
    // Like fetch, the request fails once its signal aborts.
    fetchMock.mockImplementation(
      (request) =>
        new Promise((_resolve, reject) => {
          request.signal.addEventListener("abort", () => {
            reject(
              new DOMException("The operation timed out.", "TimeoutError"),
            );
          });
        }),
    );

    const result = fetchCurrentUser().catch((reason: unknown) => reason);
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    timeout.abort(new DOMException("The operation timed out.", "TimeoutError"));

    const error = await result;
    expect(timeoutSpy).toHaveBeenCalledWith(CURRENT_USER_TIMEOUT_MS);
    expect(error).toBeInstanceOf(ApiNetworkError);
    expect(error).toMatchObject({ cause: { name: "TimeoutError" } });
    timeoutSpy.mockRestore();
  });

  it("returns null without calling the API when there is no session cookie", async () => {
    withCookies("theme");

    await expect(fetchCurrentUser()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getCurrentUser", () => {
  beforeEach(() => {
    resetCaches();
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

describe("resolveAuthState", () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    resetCaches();
    withCookies("montelingo_session");
    fetchMock.mockReset();
    getApiClientMock.mockImplementation(() =>
      createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
    );
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("returns the signed-in user", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, makeUserResource()));

    await expect(resolveAuthState()).resolves.toEqual({
      status: "signed-in",
      user: {
        id: "8f14e45f-ceea-4e7a-9b1c-3c5d2a6f0b11",
        email: "ana@example.com",
        createdAt: "2026-09-01T10:00:00Z",
      },
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("is signed out when the session is no longer valid (401)", async () => {
    fetchMock.mockResolvedValue(errorResponse(401, "authentication_error"));

    await expect(resolveAuthState()).resolves.toEqual({
      status: "signed-out",
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("is signed out without calling the API when there is no session cookie", async () => {
    withCookies();

    await expect(resolveAuthState()).resolves.toEqual({
      status: "signed-out",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is unavailable, and logs why, when the API fails", async () => {
    fetchMock.mockResolvedValue(errorResponse(503, "service_unavailable"));

    await expect(resolveAuthState()).resolves.toEqual({
      status: "unavailable",
    });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "auth_current_user_unavailable reason=%s request_id=%s",
      "status_503",
      "req-1",
      expect.any(ApiClientError),
    );
  });

  it("is unavailable, and logs why, when the API is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(resolveAuthState()).resolves.toEqual({
      status: "unavailable",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "auth_current_user_unavailable reason=%s request_id=%s",
      "unreachable",
      "-",
      expect.any(ApiNetworkError),
    );
  });

  it("is unavailable, and logs it, on an unexpected error", async () => {
    getApiClientMock.mockImplementation(() => {
      throw new Error("bug");
    });

    await expect(resolveAuthState()).resolves.toEqual({
      status: "unavailable",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "auth_current_user_unavailable reason=%s request_id=%s",
      "unexpected",
      "-",
      expect.any(Error),
    );
  });

  it("is unavailable, and logs a timeout, when the API does not answer in time", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError"),
    );

    await expect(resolveAuthState()).resolves.toEqual({
      status: "unavailable",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "auth_current_user_unavailable reason=%s request_id=%s",
      "timeout",
      "-",
      expect.any(ApiNetworkError),
    );
  });

  it.each(["TimeoutError", "AbortError"])(
    "logs a timeout when the body read fails with %s",
    async (name) => {
      // The headers arrived in time, then the signal fired mid-body: the read
      // rejects with the DOMException itself, not an ApiNetworkError.
      fetchMock.mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new DOMException("Timed out.", name));
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      await expect(resolveAuthState()).resolves.toEqual({
        status: "unavailable",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "auth_current_user_unavailable reason=%s request_id=%s",
        "timeout",
        "-",
        expect.objectContaining({ name }),
      );
    },
  );

  it("lets cookies()'s dynamic-rendering signal through to Next.js", async () => {
    const signal = new DynamicServerError("Route / used `cookies`.");
    cookiesMock.mockRejectedValue(signal);

    await expect(resolveAuthState()).rejects.toBe(signal);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("lets redirect() and the other Next.js control-flow errors through", async () => {
    cookiesMock.mockImplementation(() => redirect("/elsewhere"));

    await expect(resolveAuthState()).rejects.toThrow("NEXT_REDIRECT");
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("getAuthState", () => {
  beforeEach(() => {
    resetCaches();
    withCookies("montelingo_session");
    fetchMock.mockReset();
    getApiClientMock.mockImplementation(() =>
      createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
    );
  });

  it("is resolveAuthState wrapped in React cache()", () => {
    expect(cacheMock).toHaveBeenCalledWith(resolveAuthState);
    const index = cacheMock.mock.calls.findIndex(
      ([fn]) => fn === resolveAuthState,
    );
    expect(getAuthState).toBe(cacheMock.mock.results[index]?.value);
  });

  it("shares getCurrentUser's API call", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(200, makeUserResource())),
    );

    const [state, user] = await Promise.all([getAuthState(), getCurrentUser()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(state).toEqual({ status: "signed-in", user });
  });
});
