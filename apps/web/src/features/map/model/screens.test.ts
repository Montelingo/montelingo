import { describe, expect, it } from "vitest";

import {
  makeLocation,
  makeRegion,
  newAccountProgress,
  seedRegionDetail,
  seedRegions,
} from "../test-fixtures";
import { MAP_ELEMENT_STATES, type MapElementState } from "./map-state";
import type { ProgressResult } from "./progress";
import {
  closedLocationRedirect,
  lockedRegionRedirect,
  needsProgressRetry,
  toLocationScreen,
  toRegionPickerRegions,
  toRegionScreen,
} from "./screens";

const OPEN_OR_UNKNOWN = MAP_ELEMENT_STATES.filter(
  (state) => state !== "locked",
);
// The states a place can be opened in; the server sets all but `active`.
const OPEN = ["available", "active", "in-progress", "completed"] as const;
// No state from the server: progress failed, or has no entry.
const UNKNOWN = ["loading", "error"] as const;

function pairs<A, B>(as: readonly A[], bs: readonly B[]): [A, B][] {
  return as.flatMap((a) => bs.map((b): [A, B] => [a, b]));
}

describe("toRegionPickerRegions", () => {
  it("gives a new account the coast, with the other regions locked, in content order", () => {
    expect(toRegionPickerRegions(seedRegions(), newAccountProgress())).toEqual([
      { id: "coast", name: "Obala", state: "available", href: "/play/coast" },
      {
        id: "central",
        name: "Centralna Crna Gora",
        state: "locked",
        href: "/play/central",
      },
      {
        id: "north",
        name: "Sjever i planine",
        state: "locked",
        href: "/play/north",
      },
    ]);
  });

  it("puts every region in the error state when progress failed", () => {
    const regions = toRegionPickerRegions(seedRegions(), { status: "error" });

    expect(regions.map(({ state }) => state)).toEqual([
      "error",
      "error",
      "error",
    ]);
  });

  it("gives a region progress does not cover the loading state", () => {
    const regions = toRegionPickerRegions(
      [makeRegion({ id: "coast" }), makeRegion({ id: "east", name: "East" })],
      {
        status: "ready",
        progress: {
          regions: [{ id: "coast", state: "completed" }],
          locations: [],
        },
      },
    );

    expect(regions.map(({ state }) => state)).toEqual(["completed", "loading"]);
  });
});

describe("toRegionScreen", () => {
  it("opens Budva for a new account and marks it as the next place", () => {
    const screen = toRegionScreen(
      seedRegionDetail("coast"),
      newAccountProgress(),
    );

    expect(screen.region).toEqual({
      id: "coast",
      name: "Obala",
      state: "available",
    });
    expect(screen.locations[0]).toEqual({
      id: "budva",
      name: "Budva",
      state: "available",
      href: "/play/coast/budva",
      isNext: true,
    });
    expect(
      screen.locations
        .slice(1)
        .map(({ id, state, href, isNext }) => ({ id, state, href, isNext })),
    ).toEqual(
      ["kotor", "ulcinj", "herceg-novi", "tivat", "bar"].map((id) => ({
        id,
        state: "locked",
        href: `/play/coast/${id}`,
        isNext: false,
      })),
    );
  });

  it.each([
    ["central", 5],
    ["north", 6],
  ] as const)(
    "keeps every location of %s locked for a new account",
    (regionId, count) => {
      const screen = toRegionScreen(
        seedRegionDetail(regionId),
        newAccountProgress(),
      );

      expect(screen.region.state).toBe("locked");
      expect(screen.locations).toHaveLength(count);
      expect(
        screen.locations.every(
          ({ state, isNext }) => state === "locked" && !isNext,
        ),
      ).toBe(true);
    },
  );

  it("marks only the first place that can be opened as next", () => {
    const region = {
      id: "coast",
      name: "Obala",
      locations: [
        makeLocation({ id: "budva" }),
        makeLocation({ id: "kotor" }),
        makeLocation({ id: "tivat" }),
      ],
    };
    const progress: ProgressResult = {
      status: "ready",
      progress: {
        regions: [{ id: "coast", state: "in-progress" }],
        locations: [
          { id: "budva", state: "completed" },
          { id: "kotor", state: "in-progress" },
          { id: "tivat", state: "available" },
        ],
      },
    };

    const screen = toRegionScreen(region, progress);

    expect(screen.locations.map(({ isNext }) => isNext)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("marks nothing as next and puts everything in error when progress failed", () => {
    const screen = toRegionScreen(seedRegionDetail("coast"), {
      status: "error",
    });

    expect(screen.region.state).toBe("error");
    expect(screen.locations.map(({ state }) => state)).toEqual(
      Array.from({ length: 6 }, () => "error"),
    );
    expect(screen.locations.some(({ isNext }) => isNext)).toBe(false);
  });

  it("gives the region the loading state when progress does not cover it", () => {
    const screen = toRegionScreen(seedRegionDetail("coast"), {
      status: "ready",
      progress: { regions: [], locations: [] },
    });

    expect(screen.region.state).toBe("loading");
  });
});

describe("toLocationScreen", () => {
  const coast = seedRegionDetail("coast");
  const budva = {
    id: "budva",
    name: "Budva",
    regionId: "coast",
    chapters: [{ id: "the-sea", title: "The sea", position: 1, words: [] }],
  };

  it("gives the location and its region their states, keeping the chapters", () => {
    expect(toLocationScreen(coast, budva, newAccountProgress())).toEqual({
      region: { id: "coast", name: "Obala", state: "available" },
      location: { ...budva, state: "available" },
    });
  });

  it("puts both in the error state when progress failed", () => {
    const screen = toLocationScreen(coast, budva, { status: "error" });

    expect(screen.region.state).toBe("error");
    expect(screen.location.state).toBe("error");
  });

  it("gives both the loading state when progress does not cover them", () => {
    const screen = toLocationScreen(coast, budva, {
      status: "ready",
      progress: { regions: [], locations: [] },
    });

    expect(screen.region.state).toBe("loading");
    expect(screen.location.state).toBe("loading");
  });
});

describe("lockedRegionRedirect", () => {
  it("sends a locked region back to the map with a notice", () => {
    expect(lockedRegionRedirect("locked")).toBe("/play?notice=region-locked");
  });

  it.each(OPEN_OR_UNKNOWN)("stays on a %s region", (state) => {
    expect(lockedRegionRedirect(state)).toBeNull();
  });
});

describe("closedLocationRedirect", () => {
  it.each(MAP_ELEMENT_STATES)(
    "sends any location in a locked region back to the map (%s)",
    (locationState) => {
      expect(closedLocationRedirect("north", "locked", locationState)).toBe(
        "/play?notice=region-locked",
      );
    },
  );

  it.each(OPEN_OR_UNKNOWN)(
    "sends a locked location in a %s region back to the region, saying why",
    (regionState) => {
      expect(closedLocationRedirect("coast", regionState, "locked")).toBe(
        "/play/coast?notice=location-locked",
      );
    },
  );

  it.each(pairs(OPEN_OR_UNKNOWN, UNKNOWN))(
    "sends a %s region's %s location back to the region, with no notice",
    (regionState, locationState) => {
      expect(closedLocationRedirect("coast", regionState, locationState)).toBe(
        "/play/coast",
      );
    },
  );

  it.each(pairs(UNKNOWN, OPEN))(
    "sends a %s region's %s location back to the region, with no notice",
    (regionState, locationState) => {
      expect(closedLocationRedirect("coast", regionState, locationState)).toBe(
        "/play/coast",
      );
    },
  );

  it.each(pairs(OPEN, OPEN))(
    "stays on a %s region's %s location",
    (regionState, locationState) => {
      expect(
        closedLocationRedirect("coast", regionState, locationState),
      ).toBeNull();
    },
  );
});

describe("needsProgressRetry", () => {
  it.each(UNKNOWN)("is true when any item is %s", (state) => {
    expect(needsProgressRetry([{ state: "available" }, { state }])).toBe(true);
  });

  it.each(["locked", ...OPEN] as const)(
    "is false when every item is %s",
    (state: MapElementState) => {
      expect(needsProgressRetry([{ state }, { state: "locked" }])).toBe(false);
    },
  );

  it("is false for no items", () => {
    expect(needsProgressRetry([])).toBe(false);
  });
});
