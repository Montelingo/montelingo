import {
  type ApiClient,
  ApiClientError,
  createApiClient,
} from "@app/api-client";
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

import { fetchPlayers, getPlayers } from "./players-api";

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

const MIA_ID = "00000000-0000-4000-8000-00000000a001";

const MIA = {
  id: MIA_ID,
  name: "Mia",
  age_band: "5-6",
  avatar: "owl",
  is_complete: true,
  is_active: true,
};

describe("fetchPlayers", () => {
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
    expect(cacheMock).toHaveBeenCalledWith(fetchPlayers);
    expect(getPlayers).toBe(fetchPlayers);
  });

  it("asks the API for the players with the incoming cookies", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, [MIA]));

    await expect(fetchPlayers()).resolves.toEqual([
      {
        id: MIA_ID,
        name: "Mia",
        ageBand: "5-6",
        avatar: "owl",
        isComplete: true,
        isActive: true,
      },
    ]);
    expect(getApiClientMock).toHaveBeenCalledWith({ forwardCookies: true });
    expect(fetchMock.mock.calls[0]?.[0].url).toBe(
      "http://api.test/api/v1/players",
    );
  });

  it("throws a 401, unlogged, so the caller can send the learner to sign in", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, ERROR("authentication_error")),
    );

    const result = fetchPlayers();

    await expect(result).rejects.toBeInstanceOf(ApiClientError);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("returns null and logs for any other failure", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(500, ERROR("internal_server_error")),
    );

    await expect(fetchPlayers()).resolves.toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      "players_unavailable reason=%s request_id=%s",
      "status_500",
      "req-1",
      expect.anything(),
    );
  });

  it("returns null for a player outside the contract", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, [{ ...MIA, id: "not-a-uuid" }]),
    );

    await expect(fetchPlayers()).resolves.toBeNull();
  });
});
