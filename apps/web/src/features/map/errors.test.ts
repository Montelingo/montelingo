import { ApiClientError, ApiNetworkError } from "@app/api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mapErrorMessages,
  notFoundOnMissingContent,
  toMapErrorMessage,
} from "./errors";

class NotFoundSignal extends Error {}

const notFoundMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

beforeEach(() => {
  notFoundMock.mockReset();
  notFoundMock.mockImplementation(() => {
    throw new NotFoundSignal();
  });
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
