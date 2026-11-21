import { describe, expect, it } from "vitest";

import {
  newAccountProgress,
  seedRegionDetail,
  seedRegionDetails,
  seedRegions,
} from "../test-fixtures";
import type { ProgressResult } from "./progress";
import { hiddenStickersText, STARS_PER_PLACE, toPrizesData } from "./prizes";

// The coast and Budva done, the centre open, the north locked.
const COAST_STARTED: ProgressResult = {
  status: "ready",
  progress: {
    regions: [
      { id: "coast", state: "in-progress" },
      { id: "central", state: "available" },
      { id: "north", state: "locked" },
    ],
    locations: [
      { id: "budva", state: "completed" },
      { id: "kotor", state: "in-progress" },
      { id: "tivat", state: "completed" },
    ],
  },
};

describe("toPrizesData", () => {
  it("keeps the regions in content order", () => {
    const { regions } = toPrizesData(
      seedRegions(),
      seedRegionDetails(),
      COAST_STARTED,
    );

    expect(regions.map(({ id }) => id)).toEqual(["coast", "central", "north"]);
  });

  it("gives an open region one sticker per place, in content order, earned when the place is completed", () => {
    const [coast] = toPrizesData(
      seedRegions(),
      seedRegionDetails(),
      COAST_STARTED,
    ).regions;

    expect(coast).toMatchObject({ kind: "open", name: "Obala" });
    expect(coast?.kind === "open" ? coast.stickers : []).toEqual([
      { id: "budva", name: "Budva", isEarned: true, artUrl: null },
      { id: "kotor", name: "Kotor", isEarned: false, artUrl: null },
      { id: "ulcinj", name: "Ulcinj", isEarned: false, artUrl: null },
      { id: "herceg-novi", name: "Herceg Novi", isEarned: false, artUrl: null },
      { id: "tivat", name: "Tivat", isEarned: true, artUrl: null },
      { id: "bar", name: "Bar", isEarned: false, artUrl: null },
    ]);
  });

  it("gives an open region three stars for each of its places", () => {
    const [coast] = toPrizesData(
      seedRegions(),
      seedRegionDetails(),
      COAST_STARTED,
    ).regions;

    expect(STARS_PER_PLACE).toBe(3);
    expect(coast).toMatchObject({ kind: "open", maxStars: 18 });
  });

  it("shows a locked region only with its name and how many stickers it hides", () => {
    const north = toPrizesData(
      seedRegions(),
      seedRegionDetails(),
      COAST_STARTED,
    ).regions[2];

    expect(north).toEqual({
      kind: "locked",
      id: "north",
      name: "Sjever i planine",
      stickerCount: 6,
    });
  });

  it("counts a locked region's stickers from the region list's locationCount", () => {
    const regions = seedRegions().map((region) =>
      region.id === "central" ? { ...region, locationCount: 7 } : region,
    );

    const central = toPrizesData(
      regions,
      seedRegionDetails(),
      newAccountProgress(),
    ).regions[1];

    expect(central).toMatchObject({ kind: "locked", stickerCount: 7 });
  });

  it("shows every region open with nothing earned when progress failed, and asks for a retry", () => {
    const data = toPrizesData(seedRegions(), seedRegionDetails(), {
      status: "error",
    });

    expect(data.regions.every(({ kind }) => kind === "open")).toBe(true);
    expect(
      data.regions.flatMap((region) =>
        region.kind === "open" ? region.stickers : [],
      ),
    ).not.toContainEqual(expect.objectContaining({ isEarned: true }));
    expect(data.needsProgressRetry).toBe(true);
  });

  it("does not ask for a retry for a locked region's places, which it does not show", () => {
    const data = toPrizesData(seedRegions(), seedRegionDetails(), {
      status: "ready",
      progress: {
        regions: [
          { id: "coast", state: "available" },
          { id: "central", state: "locked" },
          { id: "north", state: "locked" },
        ],
        locations: seedRegionDetail("coast").locations.map(({ id }) => ({
          id,
          state: "available" as const,
        })),
      },
    });

    expect(data.needsProgressRetry).toBe(false);
  });

  it("asks for a retry when an open region's place has no state", () => {
    const data = toPrizesData(seedRegions(), seedRegionDetails(), {
      status: "ready",
      progress: {
        regions: [
          { id: "coast", state: "available" },
          { id: "central", state: "locked" },
          { id: "north", state: "locked" },
        ],
        locations: [],
      },
    });

    expect(data.needsProgressRetry).toBe(true);
  });

  it("does not ask for a retry when progress has every region and place", () => {
    const data = toPrizesData(
      seedRegions(),
      seedRegionDetails(),
      newAccountProgress(),
    );

    expect(data.needsProgressRetry).toBe(false);
  });
});

describe("hiddenStickersText", () => {
  it.each([
    [1, "1 naljepnica se krije u oblacima"],
    [2, "2 naljepnice se kriju u oblacima"],
    [4, "4 naljepnice se kriju u oblacima"],
    [5, "5 naljepnica se krije u oblacima"],
    [6, "6 naljepnica se krije u oblacima"],
    [11, "11 naljepnica se krije u oblacima"],
    [12, "12 naljepnica se krije u oblacima"],
    [21, "21 naljepnica se krije u oblacima"],
    [22, "22 naljepnice se kriju u oblacima"],
  ])("says %i stickers in Montenegrin", (count, text) => {
    expect(hiddenStickersText(count)).toBe(text);
  });
});
