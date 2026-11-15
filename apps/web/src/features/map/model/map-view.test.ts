import { describe, expect, it } from "vitest";

import {
  allOpenProgress,
  makeLocation,
  newAccountProgress,
  seedRegionDetails,
} from "../test-fixtures";
import { MAP_GEOMETRY } from "./map-geometry";
import {
  currentRegion,
  isFogged,
  levelCardHref,
  mapViewBox,
  toMapData,
} from "./map-view";
import type { ProgressResult } from "./progress";

describe("toMapData", () => {
  it("gives a new account the coast open, Budva next and the rest locked", () => {
    const { regions, places } = toMapData(
      seedRegionDetails(),
      newAccountProgress(),
    );

    expect(regions.map(({ id, state }) => [id, state])).toEqual([
      ["coast", "available"],
      ["central", "locked"],
      ["north", "locked"],
    ]);
    expect(places.filter(({ isNext }) => isNext).map(({ id }) => id)).toEqual([
      "budva",
    ]);
    expect(places.find(({ id }) => id === "kotor")?.state).toBe("locked");
  });

  it("numbers places within their region, in content order", () => {
    const { places } = toMapData(seedRegionDetails(), newAccountProgress());

    expect(
      places
        .filter(({ regionId }) => regionId === "central")
        .map(({ id, order }) => [id, order]),
    ).toEqual([
      ["podgorica", 1],
      ["cetinje", 2],
      ["niksic", 3],
      ["danilovgrad", 4],
      ["skadar-lake", 5],
    ]);
  });

  it("links each region to its screen and each place to its own", () => {
    const { regions, places } = toMapData(
      seedRegionDetails(),
      newAccountProgress(),
    );

    expect(regions[0]?.href).toBe("/play/coast");
    expect(places.find(({ id }) => id === "budva")?.href).toBe(
      "/play/coast/budva",
    );
  });

  it("counts each region's completed places out of all of them", () => {
    const open = allOpenProgress();
    const progress: ProgressResult =
      open.status === "ready"
        ? {
            status: "ready",
            progress: {
              ...open.progress,
              locations: open.progress.locations.map((entry) =>
                entry.id === "budva"
                  ? { ...entry, state: "completed" as const }
                  : entry,
              ),
            },
          }
        : open;

    const coast = toMapData(seedRegionDetails(), progress).regions[0];

    expect([coast?.completedCount, coast?.placeCount]).toEqual([1, 6]);
  });

  it("puts every place in the error state when progress failed", () => {
    const { regions, places } = toMapData(seedRegionDetails(), {
      status: "error",
    });

    expect(new Set([...regions, ...places].map(({ state }) => state))).toEqual(
      new Set(["error"]),
    );
    expect(places.some(({ isNext }) => isNext)).toBe(false);
  });

  it("leaves out a place the map has no art for", () => {
    const details = seedRegionDetails().map((region) =>
      region.id === "coast"
        ? {
            ...region,
            locations: [
              ...region.locations,
              makeLocation({ id: "perast", name: "Perast", regionId: "coast" }),
            ],
          }
        : region,
    );

    const { places } = toMapData(details, allOpenProgress());

    expect(places.map(({ id }) => id)).not.toContain("perast");
  });
});

describe("mapViewBox", () => {
  it("shows the whole country without a region", () => {
    expect(mapViewBox(null)).toEqual(MAP_GEOMETRY.focus);
  });

  it("zooms to a region as the build script framed it", () => {
    expect(mapViewBox("coast")).toEqual(MAP_GEOMETRY.regions.coast.focus);
  });

  it("shows the whole country for a region it does not know", () => {
    expect(mapViewBox("atlantis")).toEqual(mapViewBox(null));
  });

  it("frames every place of a region, marker and name", () => {
    for (const { regionId, marker, label } of Object.values(
      MAP_GEOMETRY.locations,
    )) {
      const view = mapViewBox(regionId);
      expect(marker.cx - marker.r).toBeGreaterThanOrEqual(view.x);
      expect(marker.cy - marker.r).toBeGreaterThanOrEqual(view.y);
      expect(label.cx).toBeLessThanOrEqual(view.x + view.width);
      expect(label.cy + label.height / 2).toBeLessThanOrEqual(
        view.y + view.height,
      );
    }
  });
});

describe("MAP_GEOMETRY", () => {
  type Box = { x: number; y: number; width: number; height: number };
  const overlaps = (a: Box, b: Box) =>
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0 &&
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0;
  const markerBox = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => ({
    x: cx - r,
    y: cy - r,
    width: 2 * r,
    height: 2 * r,
  });

  const labelBox = ({
    cx,
    cy,
    width,
    height,
  }: {
    cx: number;
    cy: number;
    width: number;
    height: number;
  }) => ({ x: cx - width / 2, y: cy - height / 2, width, height });

  it("never covers a place's name or marker with another place", () => {
    const places = Object.entries(MAP_GEOMETRY.locations);
    for (const [id, a] of places) {
      for (const [otherId, b] of places) {
        if (otherId === id || b.regionId !== a.regionId) {
          continue;
        }
        for (const mine of [a.card, markerBox(a.marker)]) {
          expect(
            overlaps(mine, labelBox(b.label)) ||
              overlaps(mine, markerBox(b.marker)),
            `${id} covers ${otherId}`,
          ).toBe(false);
        }
      }
    }
  });

  it("puts each place's marker on its town, under its name", () => {
    for (const { dot, marker, label } of Object.values(
      MAP_GEOMETRY.locations,
    )) {
      expect([marker.cx, marker.cy]).toEqual([dot.cx, dot.cy]);
      expect(label.cy).toBeLessThan(marker.cy);
    }
  });
});

describe("currentRegion", () => {
  const { regions, places } = toMapData(
    seedRegionDetails(),
    newAccountProgress(),
  );

  it("is the zoomed region", () => {
    expect(currentRegion(regions, places, "central")?.id).toBe("central");
  });

  it("is the next place's region on the whole map", () => {
    expect(currentRegion(regions, places, null)?.id).toBe("coast");
  });

  it("is the first open region when there is no next place", () => {
    const done = places.map((place) => ({ ...place, isNext: false }));

    expect(currentRegion(regions, done, null)?.id).toBe("coast");
  });

  it("is none when nothing is open", () => {
    const locked = regions.map((region) => ({
      ...region,
      state: "locked" as const,
    }));

    expect(currentRegion(locked, [], null)).toBeNull();
  });
});

describe("levelCardHref", () => {
  it("opens the place's card over its region's map", () => {
    expect(levelCardHref({ id: "kotor", regionId: "coast" })).toBe(
      "/play/coast?place=kotor",
    );
  });

  it("encodes the id, so it can never add to the URL", () => {
    expect(levelCardHref({ id: "a&b", regionId: "coast" })).toBe(
      "/play/coast?place=a%26b",
    );
  });
});

describe("isFogged", () => {
  it("fogs a locked region only", () => {
    expect(isFogged("locked")).toBe(true);
    expect(isFogged("available")).toBe(false);
    expect(isFogged("error")).toBe(false);
  });
});
