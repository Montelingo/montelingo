import { describe, expect, it } from "vitest";

import { backHref, isAtPath, isWithinPath, parentPath } from "./paths";

describe("parentPath", () => {
  it.each([
    ["/play/kotor", "/play"],
    ["/play/kotor/", "/play"],
    ["/play/kotor/old-town", "/play/kotor"],
    ["/play/kotor/old-town/", "/play/kotor"],
    ["/play//kotor//old-town", "/play/kotor"],
    ["/play/kotor/old-town/gate", "/play/kotor/old-town"],
  ])("goes from %j up to %j", (pathname, expected) => {
    expect(parentPath(pathname, "/play")).toBe(expected);
  });

  it.each(["/play", "/play/", "/play//"])(
    "has no parent at the root, %j",
    (pathname) => {
      expect(parentPath(pathname, "/play")).toBeNull();
    },
  );

  it.each(["/", "/account", "/playground", "/player/1", "/Play/kotor"])(
    "has no parent outside the root, %j",
    (pathname) => {
      expect(parentPath(pathname, "/play")).toBeNull();
    },
  );
});

describe("isWithinPath", () => {
  it.each(["/play", "/play/", "/play/kotor", "/play/kotor/old-town"])(
    "puts %j inside /play",
    (pathname) => {
      expect(isWithinPath(pathname, "/play")).toBe(true);
    },
  );

  it.each(["/", "/playground", "/account/play"])(
    "puts %j outside /play",
    (pathname) => {
      expect(isWithinPath(pathname, "/play")).toBe(false);
    },
  );
});

describe("isAtPath", () => {
  it.each([
    ["/play", true],
    ["/play/", true],
    ["/play/kotor", false],
    ["/playground", false],
    ["/", false],
  ])("%j is /play: %j", (pathname, expected) => {
    expect(isAtPath(pathname, "/play")).toBe(expected);
  });
});

describe("backHref", () => {
  const targets = { homeHref: "/play", exitHref: "/" };

  it("leaves the area from the map", () => {
    expect(backHref("/play", targets)).toBe("/");
    expect(backHref("/play/", targets)).toBe("/");
  });

  it("goes from a region back to the map", () => {
    expect(backHref("/play/kotor", targets)).toBe("/play");
  });

  it("goes from a place back to its region", () => {
    expect(backHref("/play/kotor/old-town", targets)).toBe("/play/kotor");
  });

  it("leaves the area from a page outside it", () => {
    expect(backHref("/account", targets)).toBe("/");
  });
});
