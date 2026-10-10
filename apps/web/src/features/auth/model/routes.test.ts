import { describe, expect, it } from "vitest";

import {
  authPageHref,
  postAuthRedirectPath,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
} from "./routes";

describe("postAuthRedirectPath", () => {
  it.each([
    ["/", "/"],
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
  ])("falls back to / for %s", (_case, next) => {
    expect(postAuthRedirectPath(next)).toBe("/");
  });

  it.each([
    ["missing", undefined],
    ["an absolute URL", "https://evil.com"],
    ["a protocol-relative URL", "//evil.com"],
    ["an API path", "/api/v1/auth/me"],
    ["a repeated parameter", ["/a", "/b"]],
  ])("falls back to / when the destination is %s", (_case, next) => {
    expect(postAuthRedirectPath(next)).toBe("/");
  });
});

describe("authPageHref", () => {
  it("carries a safe destination as ?next=", () => {
    expect(authPageHref(SIGN_UP_PATH, "/lessons/42?tab=words")).toBe(
      "/sign-up?next=%2Flessons%2F42%3Ftab%3Dwords",
    );
  });

  it.each([
    ["missing", undefined],
    ["the default", "/"],
    ["an absolute URL", "https://evil.com"],
    ["a protocol-relative URL", "//evil.com"],
    ["an API path", "/api/v1/auth/me"],
    ["an auth page", "/sign-up"],
    ["an encoded auth page", "/%73ign-up/"],
  ])("links to the bare page when the destination is %s", (_case, next) => {
    expect(authPageHref(SIGN_IN_PATH, next)).toBe("/sign-in");
  });
});
