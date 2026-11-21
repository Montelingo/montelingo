import { describe, expect, it } from "vitest";

import {
  chapterPath,
  gamePath,
  lessonPath,
  locationPath,
  regionPath,
} from "./paths";

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

describe("chapterPath", () => {
  it("puts the chapter under its place, each id in one segment", () => {
    expect(chapterPath("coast", "budva", "budva-beach")).toBe(
      "/play/coast/budva/budva-beach",
    );
    expect(chapterPath("coast", "budva", "a/b")).toBe(
      "/play/coast/budva/a%2Fb",
    );
  });
});

describe("lessonPath", () => {
  it("puts the lesson under its chapter", () => {
    expect(lessonPath("coast", "budva", "budva-beach")).toBe(
      "/play/coast/budva/budva-beach/lesson",
    );
  });
});

describe("gamePath", () => {
  it("puts a game with a screen under its chapter", () => {
    expect(gamePath("coast", "budva", "budva-beach", "memory")).toBe(
      "/play/coast/budva/budva-beach/memory",
    );
  });

  it("has no path for a game without a screen yet", () => {
    expect(gamePath("coast", "budva", "budva-beach", "match")).toBeNull();
  });
});
