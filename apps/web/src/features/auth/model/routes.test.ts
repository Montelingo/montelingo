import { describe, expect, it } from "vitest";

import {
  authPageHref,
  parseSignInNotice,
  postAuthRedirectPath,
  SIGN_IN_PATH,
  signInHref,
  SIGN_UP_PATH,
  signInNoticeHref,
} from "./routes";

describe("postAuthRedirectPath", () => {
  it.each([
    // The home page, asked for explicitly, is kept.
    ["/", "/"],
    ["/play/coast", "/play/coast"],
    ["/lessons/42?tab=words#top", "/lessons/42?tab=words#top"],
    // Only the auth pages themselves are excluded, not similar paths.
    ["/sign-in-help", "/sign-in-help"],
    ["/sign-in/faq", "/sign-in/faq"],
    ["/lessons/sign-in", "/lessons/sign-in"],
    ["/account?from=/sign-in", "/account?from=/sign-in"],
  ])("keeps %j", (next, expected) => {
    expect(postAuthRedirectPath(next)).toBe(expected);
  });

  it.each([
    ["sign-in", "/sign-in"],
    ["sign-up", "/sign-up"],
    ["forgot-password", "/forgot-password"],
    ["reset-password", "/reset-password"],
    ["an auth page with a query", "/reset-password?token=abc"],
    ["an auth page with a fragment", "/sign-in#form"],
    ["a nested next chain", "/sign-in?next=%2Fsign-up%3Fnext%3D%252Flessons"],
    ["a trailing slash", "/sign-in/"],
    ["several trailing slashes", "/sign-up//"],
    ["another case", "/Sign-In"],
    ["a percent-encoded path", "/%73ign-in"],
    ["a percent-encoded uppercase path", "/%53IGN-UP"],
    ["dot segments", "/lessons/../forgot-password"],
  ])("falls back to the map for %s", (_case, next) => {
    expect(postAuthRedirectPath(next)).toBe("/play");
  });

  it.each([
    ["missing", undefined],
    ["an absolute URL", "https://evil.com"],
    ["a protocol-relative URL", "//evil.com"],
    ["an API path", "/api/v1/auth/me"],
    ["a repeated parameter", ["/a", "/b"]],
  ])("falls back to the map when the destination is %s", (_case, next) => {
    expect(postAuthRedirectPath(next)).toBe("/play");
  });
});

describe("authPageHref", () => {
  it("carries a safe destination as ?next=", () => {
    expect(authPageHref(SIGN_UP_PATH, "/lessons/42?tab=words")).toBe(
      "/sign-up?next=%2Flessons%2F42%3Ftab%3Dwords",
    );
  });

  it("carries the home page as ?next=, since it is not the default", () => {
    expect(authPageHref(SIGN_UP_PATH, "/")).toBe("/sign-up?next=%2F");
  });

  it.each([
    ["missing", undefined],
    ["the default", "/play"],
    ["an absolute URL", "https://evil.com"],
    ["a protocol-relative URL", "//evil.com"],
    ["an API path", "/api/v1/auth/me"],
    ["an auth page", "/sign-up"],
    ["an encoded auth page", "/%73ign-up/"],
  ])("links to the bare page when the destination is %s", (_case, next) => {
    expect(authPageHref(SIGN_IN_PATH, next)).toBe("/sign-in");
  });
});

describe("signInHref", () => {
  it("links to sign-in, returning to the destination", () => {
    expect(signInHref("/account?tab=email")).toBe(
      "/sign-in?next=%2Faccount%3Ftab%3Demail",
    );
  });

  it.each([
    ["missing", undefined],
    ["an absolute URL", "https://evil.com"],
    ["an auth page", "/sign-up"],
  ])("links to the bare page when the destination is %s", (_case, next) => {
    expect(signInHref(next)).toBe("/sign-in");
  });
});

describe("parseSignInNotice", () => {
  it("accepts a known notice", () => {
    expect(parseSignInNotice("password-updated")).toBe("password-updated");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["unknown", "account-deleted"],
    ["in another case", "Password-Updated"],
    ["free text", "Your account is locked. Call +1 555 0100."],
    ["an inherited property", "constructor"],
    ["a prototype key", "__proto__"],
    ["a repeated parameter", ["password-updated", "password-updated"]],
  ])("ignores a notice that is %s", (_case, value) => {
    expect(parseSignInNotice(value)).toBeNull();
  });
});

describe("signInNoticeHref", () => {
  it("links to the sign-in page with the notice", () => {
    expect(signInNoticeHref("password-updated")).toBe(
      "/sign-in?notice=password-updated",
    );
  });
});
