import { describe, expect, it } from "vitest";

import type { MapElementState, ServerMapState } from "./map-state";
import {
  joinProgress,
  pickNextPlace,
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
    progress: { regions: [], locations: [], ...progress },
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
          locations: [{ id: "budva", state }],
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
        locations: [{ id: "budva", state: "available" }],
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
          { id: "budva", state: "locked" },
          { id: "atlantis-town", state: "available" },
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
          { id: "durmitor", state: "locked" },
          { id: "kotor", state: "locked" },
          { id: "budva", state: "available" },
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
        ready({ locations: [{ id: "budva", state: "available" }] }),
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

describe("toProgress", () => {
  it("keeps only the id and state of each entry", () => {
    expect(
      toProgress({
        regions: [{ id: "coast", state: "available" }],
        locations: [{ id: "budva", state: "in-progress" }],
      }),
    ).toEqual({
      regions: [{ id: "coast", state: "available" }],
      locations: [{ id: "budva", state: "in-progress" }],
    });
  });
});
