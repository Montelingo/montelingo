import { describe, expect, it } from "vitest";

import { learnerSkeletonFor } from "./learner-skeleton";

describe("learnerSkeletonFor", () => {
  it.each([
    ["/play", "map"],
    ["/play/", "map"],
    ["/play/coast", "region"],
    ["/play/coast/kotor", "location"],
    ["/play/welcome", "page"],
    ["/play/coast/kotor/extra", "page"],
    ["/account", "page"],
    ["/playground", "page"],
  ] as const)("picks the skeleton of the page at %s", (pathname, skeleton) => {
    expect(learnerSkeletonFor(pathname)).toBe(skeleton);
  });

  it("falls back to the neutral skeleton without a path", () => {
    expect(learnerSkeletonFor(null)).toBe("page");
  });
});
