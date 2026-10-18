import { describe, expect, it } from "vitest";

import { isProtectedPath } from "./protected-routes";
import {
  REQUESTED_PATH_HEADER,
  requestedPathWithin,
  withRequestedPath,
} from "./requested-path";

describe("withRequestedPath", () => {
  it("adds the requested path and query string to a copy of the headers", () => {
    const original = new Headers({ cookie: "montelingo_session=opaque" });

    const forwarded = withRequestedPath(original, {
      pathname: "/play/kotor",
      search: "?step=2",
    });

    expect(forwarded.get(REQUESTED_PATH_HEADER)).toBe("/play/kotor?step=2");
    expect(forwarded.get("cookie")).toBe("montelingo_session=opaque");
    expect(original.has(REQUESTED_PATH_HEADER)).toBe(false);
  });

  it("replaces a value the client sent", () => {
    const forwarded = withRequestedPath(
      new Headers({ [REQUESTED_PATH_HEADER]: "https://evil.com" }),
      { pathname: "/play", search: "" },
    );

    expect(forwarded.get(REQUESTED_PATH_HEADER)).toBe("/play");
  });
});

describe("requestedPathWithin", () => {
  it.each([
    ["/play", "/play"],
    ["/play?x=1", "/play?x=1"],
    ["/play/kotor", "/play/kotor"],
    ["/play/kotor/old-town?step=2", "/play/kotor/old-town?step=2"],
  ])("returns %j, inside the section", (requested, expected) => {
    expect(requestedPathWithin("/play", requested)).toBe(expected);
  });

  // The router decodes the path, so these are /play/kotor and /play, which
  // the middleware protects as part of /play. They return as requested.
  it.each([
    ["/%70lay/kotor", ""],
    ["/%70lay/kotor", "?step=2"],
    ["/%70lay", ""],
  ])("returns %j%s, encoded but inside the section", (pathname, search) => {
    expect(isProtectedPath(pathname)).toBe(true);
    expect(requestedPathWithin("/play", `${pathname}${search}`)).toBe(
      `${pathname}${search}`,
    );
  });

  it.each([
    ["missing", null],
    ["undefined", undefined],
    ["empty", ""],
    ["outside the section", "/account"],
    ["a lookalike path", "/playground"],
    ["an encoded lookalike path", "/%70layground"],
    ["a malformed encoding inside the section", "/play/%E0%A4%A"],
    ["a malformed encoding outside the section", "/%70lay/%E0%A4%A"],
    ["a path that leaves the section", "/play/../account"],
    ["an absolute URL", "https://evil.com/play"],
    ["a protocol-relative URL", "//evil.com/play"],
    ["too long", `/play?q=${"a".repeat(3000)}`],
  ])("falls back to the section when the value is %s", (_case, requested) => {
    expect(requestedPathWithin("/play", requested)).toBe("/play");
  });
});
