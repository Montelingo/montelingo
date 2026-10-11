// @vitest-environment jsdom
import { createApiClient } from "@app/api-client";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authErrorMessages } from "../errors";
import { useSignOut } from "./use-sign-out";

// Mocked at the generated-client boundary, so the real signOut() adapter runs,
// including how it treats an expired session.
const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);

vi.mock("@/lib/browser-api", () => ({
  getBrowserApiClient: () =>
    createApiClient({ baseUrl: "http://web.test", fetch: fetchMock }),
}));

function noContent(): Response {
  return new Response(null, { status: 204 });
}

function errorResponse(status: number, code: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message: "API message",
        request_id: "req-1",
        details: null,
      },
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderSignOut() {
  const onSignedOut = vi.fn();
  const view = renderHook(() => useSignOut({ onSignedOut }));
  return { ...view, onSignedOut };
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("useSignOut", () => {
  it("starts idle", () => {
    const { result } = renderSignOut();

    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("signs out, then reports it and stays pending", async () => {
    fetchMock.mockResolvedValue(noContent());
    const { result, onSignedOut } = renderSignOut();

    act(() => {
      result.current.signOut();
    });

    await waitFor(() => {
      expect(onSignedOut).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock.mock.calls[0]?.[0].url).toBe(
      "http://web.test/api/v1/auth/sign-out",
    );
    expect(result.current.isPending).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("counts a session that has already expired (401) as signed out", async () => {
    fetchMock.mockResolvedValue(errorResponse(401, "authentication_error"));
    const { result, onSignedOut } = renderSignOut();

    act(() => {
      result.current.signOut();
    });

    await waitFor(() => {
      expect(onSignedOut).toHaveBeenCalledTimes(1);
    });
    expect(result.current.error).toBeNull();
  });

  it("is pending while the call is in flight", async () => {
    const response = deferred<Response>();
    fetchMock.mockReturnValue(response.promise);
    const { result, onSignedOut } = renderSignOut();

    act(() => {
      result.current.signOut();
    });

    expect(result.current.isPending).toBe(true);
    expect(onSignedOut).not.toHaveBeenCalled();

    response.resolve(noContent());
    await waitFor(() => {
      expect(onSignedOut).toHaveBeenCalledTimes(1);
    });
  });

  it("ignores repeated calls while one is in flight", async () => {
    const response = deferred<Response>();
    fetchMock.mockReturnValue(response.promise);
    const { result, onSignedOut } = renderSignOut();

    // Both before React re-renders, like a fast double click.
    act(() => {
      result.current.signOut();
      result.current.signOut();
    });
    act(() => {
      result.current.signOut();
    });

    response.resolve(noContent());
    await waitFor(() => {
      expect(onSignedOut).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "the Origin check fails (403)",
      () => errorResponse(403, "authorization_error"),
    ],
    ["the API fails (500)", () => errorResponse(500, "internal_server_error")],
    [
      "the proxy cannot reach the API (502)",
      () => errorResponse(502, "service_unavailable"),
    ],
  ])(
    "reports a failure and stays signed in when %s",
    async (_case, response) => {
      fetchMock.mockResolvedValue(response());
      const { result, onSignedOut } = renderSignOut();

      act(() => {
        result.current.signOut();
      });

      await waitFor(() => {
        expect(result.current.error).toBe(authErrorMessages.signOutFailed);
      });
      expect(result.current.isPending).toBe(false);
      expect(onSignedOut).not.toHaveBeenCalled();
    },
  );

  it("reports a network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const { result, onSignedOut } = renderSignOut();

    act(() => {
      result.current.signOut();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(authErrorMessages.signOutFailed);
    });
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it("can try again after a failure, clearing the error meanwhile", async () => {
    fetchMock.mockResolvedValueOnce(
      errorResponse(500, "internal_server_error"),
    );
    const { result, onSignedOut } = renderSignOut();

    act(() => {
      result.current.signOut();
    });
    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    const response = deferred<Response>();
    fetchMock.mockReturnValueOnce(response.promise);
    act(() => {
      result.current.signOut();
    });

    expect(result.current.isPending).toBe(true);
    expect(result.current.error).toBeNull();

    response.resolve(noContent());
    await waitFor(() => {
      expect(onSignedOut).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
