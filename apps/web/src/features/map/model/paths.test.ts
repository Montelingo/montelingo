import { describe, expect, it } from "vitest";

import { locationPath, regionPath } from "./paths";

describe("regionPath", () => {
  it("puts the region under the map", () => {
    expect(regionPath("coast")).toBe("/play/coast");
  });

  it("keeps an id in one path segment", () => {
    expect(regionPath("a/b?c")).toBe("/play/a%2Fb%3Fc");
  });
});

describe("locationPath", () => {
  it("puts the location under its region", () => {
    expect(locationPath("coast", "budva")).toBe("/play/coast/budva");
  });

  it("keeps each id in one path segment", () => {
    expect(locationPath("coast", "../north")).toBe("/play/coast/..%2Fnorth");
  });
});
