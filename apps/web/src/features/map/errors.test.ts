import { ApiClientError, ApiNetworkError } from "@app/api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isSignedOut,
  mapErrorMessages,
  notFoundOnMissingContent,
  redirectOnSignedOut,
  toMapErrorMessage,
} from "./errors";

class NotFoundSignal extends Error {}

const notFoundMock = vi.hoisted(() => vi.fn());
// Like Next.js, redirect() throws, so nothing after it runs.
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
);

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

beforeEach(() => {
  notFoundMock.mockReset();
  notFoundMock.mockImplementation(() => {
    throw new NotFoundSignal();
  });
  redirectMock.mockClear();
});

function apiError(status: number, code: string): ApiClientError {
  return new ApiClientError(status, {
    error: {
      code,
      message: "Internal API message",
      request_id: "req-1",
      details: null,
    },
  });
}

describe("notFoundOnMissingContent", () => {
  it("calls notFound() for content_not_found", () => {
    expect(() =>
      notFoundOnMissingContent(apiError(404, "content_not_found")),
    ).toThrow(NotFoundSignal);
  });

  it.each([
    apiError(404, "not_found"),
    apiError(401, "authentication_error"),
    apiError(500, "internal_server_error"),
    new ApiNetworkError({ cause: new TypeError("fetch failed") }),
    new Error("boom"),
  ])("returns for any other error (%s)", (error) => {
    expect(() => notFoundOnMissingContent(error)).not.toThrow();
    expect(notFoundMock).not.toHaveBeenCalled();
  });
});

// Every other error: other statuses, and failures that never reached the API.
const notSignedOut = [
  apiError(403, "forbidden"),
  apiError(404, "content_not_found"),
  apiError(500, "internal_server_error"),
  new ApiNetworkError({ cause: new TypeError("fetch failed") }),
  new Error("401"),
  "a string",
];

describe("isSignedOut", () => {
  it("is true for a 401", () => {
    expect(isSignedOut(apiError(401, "authentication_error"))).toBe(true);
  });

  it.each(notSignedOut)("is false for any other error (%s)", (error) => {
    expect(isSignedOut(error)).toBe(false);
  });
});

describe("redirectOnSignedOut", () => {
  it.each([
    ["/play", "/sign-in"],
    ["/play/coast", "/sign-in?next=%2Fplay%2Fcoast"],
    ["/play/coast/budva", "/sign-in?next=%2Fplay%2Fcoast%2Fbudva"],
  ])("sends a 401 on %s to sign in, returning there", (returnTo, signInUrl) => {
    expect(() =>
      redirectOnSignedOut(apiError(401, "authentication_error"), returnTo),
    ).toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith(signInUrl);
  });

  it.each(notSignedOut)("returns for any other error (%s)", (error) => {
    expect(() => redirectOnSignedOut(error, "/play/coast")).not.toThrow();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe("toMapErrorMessage", () => {
  it("calls notFound() for content_not_found", () => {
    expect(() => toMapErrorMessage(apiError(404, "content_not_found"))).toThrow(
      NotFoundSignal,
    );
  });

  it("says the API could not be reached when the network failed", () => {
    expect(
      toMapErrorMessage(new ApiNetworkError({ cause: new TypeError("x") })),
    ).toBe(mapErrorMessages.unreachable);
    expect(toMapErrorMessage(apiError(503, "service_unavailable"))).toBe(
      mapErrorMessages.unreachable,
    );
  });

  it.each([
    apiError(500, "internal_server_error"),
    apiError(401, "authentication_error"),
    apiError(404, "not_found"),
    new Error("Internal API message"),
    "a string",
  ])("returns the generic message, never the API's (%s)", (error) => {
    const message = toMapErrorMessage(error);

    expect(message).toBe(mapErrorMessages.generic);
    expect(message).not.toContain("Internal API message");
  });
});
