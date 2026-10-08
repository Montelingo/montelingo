import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/", "/"],
    ["/lessons", "/lessons"],
    ["/lessons/42/review", "/lessons/42/review"],
    ["/lessons?x=1#h", "/lessons?x=1#h"],
    ["/lessons?next=%2Fprofile", "/lessons?next=%2Fprofile"],
    ["/a/../b", "/b"],
    ["/a/./b", "/a/b"],
    ["/lessons/caf%C3%A9", "/lessons/caf%C3%A9"],
    ["/search?q=a%20b%26c", "/search?q=a%20b%26c"],
    // Only the /api segment is the proxy; a page that merely starts with "api" is fine.
    ["/apiary", "/apiary"],
    ["/lessons/api", "/lessons/api"],
  ])("allows %j and returns %j", (next, expected) => {
    expect(safeRedirectPath(next)).toBe(expected);
  });

  it("allows a path of exactly the maximum length", () => {
    const next = `/${"a".repeat(2047)}`;

    expect(safeRedirectPath(next)).toBe(next);
  });

  it.each<[string, unknown]>([
    ["undefined", undefined],
    ["null", null],
    ["an array (repeated parameter)", ["/a", "/b"]],
    ["a number", 123],
    ["an object", { path: "/lessons" }],
    ["an empty string", ""],
    ["a relative path", "lessons"],
    ["an absolute URL", "https://evil.com"],
    ["a protocol-relative URL", "//evil.com"],
    ["a slash-backslash host", "/\\evil.com"],
    ["a double-backslash host", "\\\\evil.com"],
    ["dot segments that collapse to //", "/..//evil.com"],
    ["a single-dot segment that collapses to //", "/.//evil.com"],
    ["a parent segment that collapses to //", "/a/..//evil.com"],
    ["encoded dot segments that collapse to //", "/%2e%2e//evil.com"],
    ["a tab", "/\t/evil.com"],
    ["a newline", "/\n/evil.com"],
    ["a carriage return", "/\r/evil.com"],
    ["a NUL character", "/\u0000/evil.com"],
    ["a non-breaking space", "/ /evil.com"],
    ["a leading space", " /lessons"],
    ["a trailing space", "/lessons "],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a data: URL", "data:text/html,<script>alert(1)</script>"],
    ["the API proxy root", "/api"],
    ["an API proxy path", "/api/v1/auth/me"],
    ["an API proxy root with a query", "/api?x=1"],
    ["an API path reached through dot segments", "/%2e%2e/api/v1"],
    ["an API path reached through a parent segment", "/lessons/../api/v1"],
    ["a percent-encoded API path", "/%61pi/v1"],
    ["a path that cannot be decoded", "/lessons/%E0%A4%A"],
    ["an over-long path", `/${"a".repeat(2048)}`],
    // 2,000 characters, but over 18,000 once percent-encoded.
    ["a path that is over-long once encoded", `/${"語".repeat(2000)}`],
  ])("falls back for %s", (_case, next) => {
    expect(safeRedirectPath(next)).toBe("/");
  });

  it("uses the given fallback", () => {
    expect(safeRedirectPath("https://evil.com", "/lessons")).toBe("/lessons");
    expect(safeRedirectPath(undefined, "/lessons")).toBe("/lessons");
  });

  it("ignores the fallback for a safe path", () => {
    expect(safeRedirectPath("/profile", "/lessons")).toBe("/profile");
  });
});
