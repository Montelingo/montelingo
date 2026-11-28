import { type ApiClient, createApiClient } from "@app/api-client";
import { redirect } from "next/navigation";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import { PRIVACY_POLICY_VERSION } from "../model/policy";
import {
  getPrivacyPolicyVersion,
  POLICY_VERSION_TIMEOUT_MS,
} from "./policy-version";

const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);
const getApiClientMock = vi.hoisted(() => vi.fn<() => ApiClient>());
vi.mock("@/lib/api", () => ({ getApiClient: getApiClientMock }));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("getPrivacyPolicyVersion", () => {
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

  it("returns the version the API has in force, read without a session", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { version: "2027-03-01" }));

    await expect(getPrivacyPolicyVersion()).resolves.toBe("2027-03-01");

    expect(getApiClientMock).toHaveBeenCalledWith();
    const request = fetchMock.mock.calls[0]?.[0];
    expect(request?.method).toBe("GET");
    expect(request?.url).toBe("http://api.test/api/v1/privacy-policy");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("bounds the read with a timeout", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(jsonResponse(200, { version: "2026-12-01" }));

    await getPrivacyPolicyVersion();

    expect(timeout).toHaveBeenCalledWith(POLICY_VERSION_TIMEOUT_MS);
    timeout.mockRestore();
  });

  it.each([
    [
      "an error response",
      () =>
        Promise.resolve(
          jsonResponse(500, {
            error: {
              code: "internal_server_error",
              message: "API message",
              request_id: "req-1",
              details: null,
            },
          }),
        ),
    ],
    ["an unreachable API", () => Promise.reject(new TypeError("fetch failed"))],
  ])(
    "falls back to the version the web ships on %s, and logs it",
    async (_case, respond) => {
      fetchMock.mockImplementation(respond);

      await expect(getPrivacyPolicyVersion()).resolves.toBe(
        PRIVACY_POLICY_VERSION,
      );

      expect(consoleError).toHaveBeenCalledWith(
        "privacy_policy_version_unavailable",
        expect.anything(),
      );
    },
  );

  it("lets Next.js signals through", async () => {
    getApiClientMock.mockImplementation(() => redirect("/elsewhere"));

    await expect(getPrivacyPolicyVersion()).rejects.toThrow("NEXT_REDIRECT");
  });
});
