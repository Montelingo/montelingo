import { describe, expect, it } from "vitest";

import { NO_COUNTS } from "../test-fixtures";
import type { MapElementState, ServerMapState } from "./map-state";
import {
  joinProgress,
  pickNextPlace,
  starsByPlace,
  type Progress,
  type ProgressResult,
  toProgress,
} from "./progress";

const coast = { id: "coast", name: "Coast" };
const regions = [coast, { id: "north", name: "North" }];

const budva = { id: "budva", name: "Budva" };
const locations = [
  budva,
  { id: "kotor", name: "Kotor" },
  { id: "durmitor", name: "Durmitor" },
];

function ready(progress: Partial<Progress>): ProgressResult {
  return {
    status: "ready",
    progress: {
      regions: [],
      locations: [],
      chapters: [],
      counts: NO_COUNTS,
      ...progress,
    },
  };
}

describe("joinProgress", () => {
  it.each<ServerMapState>(["locked", "available", "in-progress", "completed"])(
    "gives a region and a location the %s state from progress",
    (state) => {
      const joined = joinProgress(
        { regions: [coast], locations: [budva] },
        ready({
          regions: [{ id: "coast", state }],
          locations: [{ id: "budva", state, stars: 0 }],
        }),
      );

      expect(joined.regions).toEqual([{ id: "coast", name: "Coast", state }]);
      expect(joined.locations).toEqual([{ id: "budva", name: "Budva", state }]);
    },
  );

  it("gives an item missing from progress the loading state, never available", () => {
    const joined = joinProgress(
      { regions, locations },
      ready({
        regions: [{ id: "coast", state: "available" }],
        locations: [{ id: "budva", state: "available", stars: 0 }],
      }),
    );

    expect(joined.regions).toEqual([
      { id: "coast", name: "Coast", state: "available" },
      { id: "north", name: "North", state: "loading" },
    ]);
    expect(joined.locations).toEqual([
      { id: "budva", name: "Budva", state: "available" },
      { id: "kotor", name: "Kotor", state: "loading" },
      { id: "durmitor", name: "Durmitor", state: "loading" },
    ]);
  });

  it("ignores progress entries for items that are not in the content", () => {
    const joined = joinProgress(
      { regions: [coast], locations: [budva] },
      ready({
        regions: [
          { id: "coast", state: "available" },
          { id: "atlantis", state: "completed" },
        ],
        locations: [
          { id: "budva", state: "locked", stars: 0 },
          { id: "atlantis-town", state: "available", stars: 0 },
        ],
      }),
    );

    expect(joined.regions).toEqual([
      { id: "coast", name: "Coast", state: "available" },
    ]);
    expect(joined.locations).toEqual([
      { id: "budva", name: "Budva", state: "locked" },
    ]);
  });

  it("keeps content order, not progress order", () => {
    const joined = joinProgress(
      { regions: [], locations },
      ready({
        locations: [
          { id: "durmitor", state: "locked", stars: 0 },
          { id: "kotor", state: "locked", stars: 0 },
          { id: "budva", state: "available", stars: 0 },
        ],
      }),
    );

    expect(joined.locations.map(({ id }) => id)).toEqual([
      "budva",
      "kotor",
      "durmitor",
    ]);
  });

  it("puts every item in the error state when progress failed", () => {
    const joined = joinProgress({ regions, locations }, { status: "error" });

    expect(joined.regions.map(({ state }) => state)).toEqual([
      "error",
      "error",
    ]);
    expect(joined.locations.map(({ state }) => state)).toEqual([
      "error",
      "error",
      "error",
    ]);
  });

  it("keeps every content field and does not change the input", () => {
    const content = {
      regions: [{ id: "coast", name: "Coast", locationCount: 7 }],
      locations: [] as { id: string }[],
    };

    const joined = joinProgress(
      content,
      ready({ regions: [{ id: "coast", state: "completed" }] }),
    );

    expect(joined.regions[0]).toEqual({
      id: "coast",
      name: "Coast",
      locationCount: 7,
      state: "completed",
    });
    expect(content.regions[0]).not.toHaveProperty("state");
  });

  it("returns empty lists for empty content", () => {
    expect(
      joinProgress(
        { regions: [], locations: [] },
        ready({ locations: [{ id: "budva", state: "available", stars: 0 }] }),
      ),
    ).toEqual({ regions: [], locations: [] });
  });
});

describe("pickNextPlace", () => {
  function places(...states: MapElementState[]) {
    return states.map((state, index) => ({ id: `place-${index}`, state }));
  }

  it("picks the first available location", () => {
    expect(pickNextPlace(places("completed", "available", "locked"))).toEqual({
      id: "place-1",
      state: "available",
    });
  });

  it("picks the first in-progress location", () => {
    expect(pickNextPlace(places("completed", "in-progress", "locked"))).toEqual(
      { id: "place-1", state: "in-progress" },
    );
  });

  it("picks whichever comes first in content order", () => {
    expect(
      pickNextPlace(places("locked", "in-progress", "available"))?.id,
    ).toBe("place-1");
    expect(
      pickNextPlace(places("locked", "available", "in-progress"))?.id,
    ).toBe("place-1");
  });

  it.each<MapElementState>([
    "locked",
    "completed",
    "active",
    "loading",
    "error",
  ])("skips a %s location", (state) => {
    expect(pickNextPlace(places(state, "available"))?.id).toBe("place-1");
  });

  it("returns null when no location can be opened", () => {
    expect(pickNextPlace(places("completed", "locked"))).toBeNull();
    expect(pickNextPlace(places("error", "error"))).toBeNull();
    expect(pickNextPlace(places("loading"))).toBeNull();
    expect(pickNextPlace([])).toBeNull();
  });
});

describe("starsByPlace", () => {
  it("gives each place the server's stars, by id", () => {
    const stars = starsByPlace({
      status: "ready",
      progress: {
        regions: [],
        locations: [
          { id: "budva", state: "completed", stars: 3 },
          { id: "kotor", state: "in-progress", stars: 1 },
        ],
        chapters: [],
        counts: { ...NO_COUNTS, stars: 4 },
      },
    });

    expect(stars && Object.fromEntries(stars)).toEqual({ budva: 3, kotor: 1 });
  });

  it("knows no stars when progress failed", () => {
    expect(starsByPlace({ status: "error" })).toBeNull();
  });
});

describe("toProgress", () => {
  it("keeps each entry's id and state, and each place's stars", () => {
    expect(
      toProgress({
        regions: [{ id: "coast", state: "available" }],
        locations: [{ id: "budva", state: "in-progress", stars: 1 }],
        chapters: [],
        counts: { words_learned: 0, stickers: 0, stars: 1 },
      }),
    ).toEqual({
      regions: [{ id: "coast", state: "available" }],
      locations: [{ id: "budva", state: "in-progress", stars: 1 }],
      chapters: [],
      counts: { wordsLearned: 0, stickers: 0, stars: 1 },
    });
  });

  it("keeps the server's counts", () => {
    expect(
      toProgress({
        regions: [],
        locations: [],
        chapters: [],
        counts: { words_learned: 40, stickers: 1, stars: 3 },
      }).counts,
    ).toEqual({ wordsLearned: 40, stickers: 1, stars: 3 });
  });

  it("keeps each chapter's lesson and games, in the server's order", () => {
    const chapter = {
      id: "budva-beach",
      lesson: "done" as const,
      games: [
        { id: "memory" as const, state: "completed" as const },
        { id: "match" as const, state: "available" as const },
      ],
    };

    expect(
      toProgress({
        regions: [],
        locations: [],
        chapters: [chapter],
        counts: { words_learned: 10, stickers: 0, stars: 0 },
      }).chapters,
    ).toEqual([chapter]);
  });
});
