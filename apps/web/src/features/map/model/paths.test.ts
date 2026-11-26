import { describe, expect, it } from "vitest";

import { existsSync } from "node:fs";
import { join } from "node:path";

import type { GameId } from "./progress";
import {
  gamePath,
  lessonPath,
  locationPath,
  practicePath,
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

describe("lessonPath", () => {
  it("puts the lesson under its chapter, under its place", () => {
    expect(lessonPath("coast", "budva", "budva-beach")).toBe(
      "/play/coast/budva/budva-beach/lesson",
    );
  });

  it("keeps each id in one path segment", () => {
    expect(lessonPath("coast", "budva", "a/b")).toBe(
      "/play/coast/budva/a%2Fb/lesson",
    );
  });
});

describe("gamePath", () => {
  it("puts a game under its chapter", () => {
    expect(gamePath("coast", "budva", "budva-beach", "memory")).toBe(
      "/play/coast/budva/budva-beach/memory",
    );
  });
});

// Every game id, so a new one fails to compile here until it is listed.
const EVERY_GAME: Record<GameId, true> = { memory: true, match: true };

const GAME_ROUTES = join(
  __dirname,
  "../../../app/(learner)/play/[regionId]/[locationId]/[chapterId]",
);

describe("every game's screen", () => {
  it.each(Object.keys(EVERY_GAME) as GameId[])(
    "has a page for %s at gamePath's route",
    (gameId) => {
      expect(existsSync(join(GAME_ROUTES, gameId, "page.tsx"))).toBe(true);
    },
  );
});

describe("practicePath", () => {
  it("puts a practice game under the Riječi tab", () => {
    expect(practicePath("match")).toBe("/play/words/match");
  });
});

const PRACTICE_ROUTES = join(
  __dirname,
  "../../../app/(learner)/play/words/(practice)",
);

describe("every practice game's screen", () => {
  it.each(Object.keys(EVERY_GAME) as GameId[])(
    "has a page for %s at practicePath's route",
    (gameId) => {
      expect(existsSync(join(PRACTICE_ROUTES, gameId, "page.tsx"))).toBe(true);
    },
  );
});
