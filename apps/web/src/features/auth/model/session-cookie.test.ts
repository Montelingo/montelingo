import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_SESSION_COOKIE_NAME,
  getSessionCookieName,
  SESSION_COOKIE_NAME_ENV,
} from "./session-cookie";

describe("getSessionCookieName", () => {
  it("defaults to the API's default name", () => {
    expect(getSessionCookieName({})).toBe("montelingo_session");
  });

  it("follows MONTELINGO_SESSION_COOKIE_NAME, like the API", () => {
    expect(
      getSessionCookieName({ MONTELINGO_SESSION_COOKIE_NAME: "ml_sid" }),
    ).toBe("ml_sid");
  });

  it.each(["", "   "])("ignores a blank override %j", (value) => {
    expect(
      getSessionCookieName({ MONTELINGO_SESSION_COOKIE_NAME: value }),
    ).toBe("montelingo_session");
  });

  it("trims the override", () => {
    expect(
      getSessionCookieName({ MONTELINGO_SESSION_COOKIE_NAME: " ml_sid " }),
    ).toBe("ml_sid");
  });
});

// Contract with the API: the web app must look for the cookie the API sets.
// The API reads its settings with the MONTELINGO_ prefix (pydantic-settings).
describe("the API's session cookie settings", () => {
  const config = readFileSync(
    new URL("../../../../../api/app/core/config.py", import.meta.url),
    "utf8",
  );

  it("has the same default name", () => {
    const match =
      /session_cookie_name:\s*str\s*=\s*Field\(\s*default="([^"]+)"/.exec(
        config,
      );

    expect(match?.[1]).toBe(DEFAULT_SESSION_COOKIE_NAME);
  });

  it("is overridden by the same environment variable", () => {
    expect(config).toMatch(/env_prefix="MONTELINGO_"/);
    expect(SESSION_COOKIE_NAME_ENV).toBe(
      `MONTELINGO_${"session_cookie_name".toUpperCase()}`,
    );
  });
});
