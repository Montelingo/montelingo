import { describe, expect, it } from "vitest";

import {
  isProtectedPath,
  PROTECTED_PATH_PREFIXES,
  signInRedirectFor,
} from "./protected-routes";

describe("PROTECTED_PATH_PREFIXES", () => {
  it("covers the account pages and the learner area", () => {
    expect(PROTECTED_PATH_PREFIXES).toEqual(["/account", "/play"]);
  });
});

describe("isProtectedPath", () => {
  it.each([
    "/account",
    "/account/",
    "/account/email",
    "/account/email/change",
    "/%61ccount",
    "/account%2Femail",
    "/play",
    "/play/",
    "/play/x",
    "/play/kotor/old-town",
    "/%70lay",
  ])("protects %j", (pathname) => {
    expect(isProtectedPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/accounting",
    "/accounts",
    "/account-help",
    "/lessons/account",
    "/Account",
    "/sign-in",
    "/%E0%A4%A",
    "/player",
    "/playground",
    "/Play",
    "/lessons/play",
  ])("leaves %j public", (pathname) => {
    expect(isProtectedPath(pathname)).toBe(false);
  });
});

describe("signInRedirectFor", () => {
  it("sends a protected page without a session cookie to sign in", () => {
    expect(
      signInRedirectFor({
        pathname: "/account",
        search: "",
        hasSessionCookie: false,
      }),
    ).toBe("/sign-in?next=%2Faccount");
  });

  it("keeps the query string in the destination", () => {
    expect(
      signInRedirectFor({
        pathname: "/account/email",
        search: "?tab=change&step=2",
        hasSessionCookie: false,
      }),
    ).toBe("/sign-in?next=%2Faccount%2Femail%3Ftab%3Dchange%26step%3D2");
  });

  it("sends the learner area without a session cookie to sign in, keeping the query", () => {
    expect(
      signInRedirectFor({
        pathname: "/play",
        search: "?x=1",
        hasSessionCookie: false,
      }),
    ).toBe("/sign-in?next=%2Fplay%3Fx%3D1");
  });

  it("lets a protected page with a session cookie through, for the page to verify", () => {
    expect(
      signInRedirectFor({
        pathname: "/account",
        search: "?tab=email",
        hasSessionCookie: true,
      }),
    ).toBeNull();
  });

  it.each(["/", "/accounting", "/lessons", "/sign-in", "/playground"])(
    "lets the public page %j through without a session cookie",
    (pathname) => {
      expect(
        signInRedirectFor({ pathname, search: "", hasSessionCookie: false }),
      ).toBeNull();
    },
  );

  it("drops a destination that would not be safe to return to", () => {
    // Too long for safeRedirectPath(), so sign-in falls back to its default.
    const search = `?q=${"a".repeat(3000)}`;

    expect(
      signInRedirectFor({
        pathname: "/account",
        search,
        hasSessionCookie: false,
      }),
    ).toBe("/sign-in");
  });
});
