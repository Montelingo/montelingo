import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_API_INTERNAL_BASE_URL,
  getApiInternalBase,
  getApiInternalBaseUrl,
  getTrustedProxyHops,
} from "./api-config";

describe("getApiInternalBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["http://api:8000", { origin: "http://api:8000", path: "" }],
    ["http://api:8000/", { origin: "http://api:8000", path: "" }],
    ["  https://api.internal  ", { origin: "https://api.internal", path: "" }],
    [
      "http://api:8000/backend//",
      { origin: "http://api:8000", path: "/backend" },
    ],
  ])("splits %j into origin and path", (value, expected) => {
    vi.stubEnv("API_INTERNAL_BASE_URL", value);

    expect(getApiInternalBase()).toEqual(expected);
  });

  it("reuses the parsed value until the variable changes", () => {
    vi.stubEnv("API_INTERNAL_BASE_URL", "http://first:8000");
    const first = getApiInternalBase();
    expect(getApiInternalBase()).toBe(first);

    vi.stubEnv("API_INTERNAL_BASE_URL", "http://second:8000/backend");
    expect(getApiInternalBase()).toEqual({
      origin: "http://second:8000",
      path: "/backend",
    });
  });

  it("throws on every call while the value is invalid, and recovers once it is fixed", () => {
    vi.stubEnv("API_INTERNAL_BASE_URL", "http://good:8000");
    getApiInternalBase();

    vi.stubEnv("API_INTERNAL_BASE_URL", "ftp://bad");
    expect(() => getApiInternalBase()).toThrow(/must use http or https/);
    expect(() => getApiInternalBase()).toThrow(/must use http or https/);

    vi.stubEnv("API_INTERNAL_BASE_URL", "http://good:8000");
    expect(getApiInternalBase()).toEqual({
      origin: "http://good:8000",
      path: "",
    });
  });
});

describe("getApiInternalBaseUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([undefined, "", "   "])(
    "falls back to the local API when the variable is %j",
    (value) => {
      vi.stubEnv("API_INTERNAL_BASE_URL", value);

      expect(getApiInternalBaseUrl()).toBe(DEFAULT_API_INTERNAL_BASE_URL);
    },
  );

  it.each([
    ["http://api:8000", "http://api:8000"],
    ["http://api:8000/", "http://api:8000"],
    ["  https://api.internal  ", "https://api.internal"],
    ["http://api:8000/backend/", "http://api:8000/backend"],
  ])("normalizes %j to %j", (value, expected) => {
    vi.stubEnv("API_INTERNAL_BASE_URL", value);

    expect(getApiInternalBaseUrl()).toBe(expected);
  });

  it("reads the variable on every call", () => {
    vi.stubEnv("API_INTERNAL_BASE_URL", "http://first:8000");
    expect(getApiInternalBaseUrl()).toBe("http://first:8000");

    vi.stubEnv("API_INTERNAL_BASE_URL", "http://second:8000");
    expect(getApiInternalBaseUrl()).toBe("http://second:8000");
  });

  it.each([
    ["api:8000", /must use http or https/],
    ["not a url", /must be an absolute http\(s\) URL/],
    ["ftp://api", /must use http or https/],
    ["http://user:secret@api:8000", /must not contain credentials/],
    ["http://api:8000?x=1", /must not contain credentials/],
    ["http://api:8000#top", /must not contain credentials/],
  ])("rejects %j", (value, message) => {
    vi.stubEnv("API_INTERNAL_BASE_URL", value);

    expect(() => getApiInternalBaseUrl()).toThrow(message);
  });
});

describe("getTrustedProxyHops", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([undefined, "", "   "])(
    "trusts no proxy when the variable is %j",
    (value) => {
      vi.stubEnv("TRUSTED_PROXY_HOPS", value);

      expect(getTrustedProxyHops()).toBe(0);
    },
  );

  it.each([
    ["0", 0],
    ["1", 1],
    [" 2 ", 2],
    ["10", 10],
  ])("parses %j as %i", (value, expected) => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", value);

    expect(getTrustedProxyHops()).toBe(expected);
  });

  it("reads the variable on every call", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    expect(getTrustedProxyHops()).toBe(1);

    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    expect(getTrustedProxyHops()).toBe(2);
  });

  it.each(["-1", "11", "1.5", "1e1", "0x1", "+1", "one", "1 2"])(
    "rejects %j",
    (value) => {
      vi.stubEnv("TRUSTED_PROXY_HOPS", value);

      expect(() => getTrustedProxyHops()).toThrow(
        `TRUSTED_PROXY_HOPS must be an integer from 0 to 10, got "${value}".`,
      );
    },
  );

  it("throws on every call while the value is invalid, and recovers once it is fixed", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    getTrustedProxyHops();

    vi.stubEnv("TRUSTED_PROXY_HOPS", "-1");
    expect(() => getTrustedProxyHops()).toThrow(/must be an integer/);
    expect(() => getTrustedProxyHops()).toThrow(/must be an integer/);

    vi.stubEnv("TRUSTED_PROXY_HOPS", "1");
    expect(getTrustedProxyHops()).toBe(1);
  });
});
