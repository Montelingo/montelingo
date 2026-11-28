import { describe, expect, it } from "vitest";

import type { Player, Profile } from "@/features/profile/edge";

import { seedRegionDetails, seedRegions } from "../test-fixtures";
import { countsText, toGrownUpsData } from "./grown-ups";
import type { ProgressResult } from "./progress";

const MIA: Profile = {
  name: "Mia",
  ageBand: "5-6",
  avatar: "owl",
  isComplete: true,
};

// Two of the coast's places done, one in progress; the rest locked.
const COAST_STARTED: ProgressResult = {
  status: "ready",
  progress: {
    regions: [
      { id: "coast", state: "in-progress" },
      { id: "central", state: "locked" },
      { id: "north", state: "locked" },
    ],
    locations: [
      { id: "budva", state: "completed", stars: 0 },
      { id: "kotor", state: "in-progress", stars: 0 },
      { id: "tivat", state: "completed", stars: 0 },
    ],
    chapters: [],
    counts: { wordsLearned: 8, stickers: 2, stars: 0, hearts: 0 },
  },
};

const PLAYERS: Player[] = [{ ...MIA, id: "player-mia", isActive: true }];

describe("toGrownUpsData", () => {
  it("gives every region, in content order, its completed places out of all", () => {
    const data = toGrownUpsData(
      seedRegions(),
      seedRegionDetails(),
      COAST_STARTED,
      MIA,
      PLAYERS,
    );

    expect(data.regions).toEqual([
      { id: "coast", name: "Obala", completed: 2, total: 6 },
      { id: "central", name: "Centralna Crna Gora", completed: 0, total: 5 },
      { id: "north", name: "Sjever i planine", completed: 0, total: 6 },
    ]);
    expect(data.explorer).toEqual({ name: "Mia", avatar: "owl" });
    expect(data.counts).toEqual({
      wordsLearned: 8,
      stickers: 2,
      stars: 0,
      hearts: 0,
    });
    expect(data.needsRetry).toBe(false);
    expect(data.players).toEqual(PLAYERS);
  });

  it("has no completed places or counts, and offers a retry, when progress failed", () => {
    const data = toGrownUpsData(
      seedRegions(),
      seedRegionDetails(),
      { status: "error" },
      MIA,
      PLAYERS,
    );

    expect(data.regions.map(({ completed }) => completed)).toEqual([
      null,
      null,
      null,
    ]);
    expect(data.regions[0]?.total).toBe(6);
    expect(data.counts).toBeNull();
    expect(data.needsRetry).toBe(true);
  });

  it("shows the placeholder explorer and offers a retry when the profile failed", () => {
    const data = toGrownUpsData(
      seedRegions(),
      seedRegionDetails(),
      COAST_STARTED,
      null,
      PLAYERS,
    );

    expect(data.explorer).toEqual({ name: "Istraživač", avatar: "fox" });
    expect(data.regions[0]?.completed).toBe(2);
    expect(data.needsRetry).toBe(true);
  });

  it("passes the players on, and leaves them out without a retry when they failed", () => {
    const data = toGrownUpsData(
      seedRegions(),
      seedRegionDetails(),
      COAST_STARTED,
      MIA,
      null,
    );

    expect(data.players).toBeNull();
    expect(data.needsRetry).toBe(false);
  });
});

describe("countsText", () => {
  it.each([
    [1, 1, "1 naučena riječ · 1 naljepnica"],
    [2, 2, "2 naučene riječi · 2 naljepnice"],
    [4, 3, "4 naučene riječi · 3 naljepnice"],
    [5, 5, "5 naučenih riječi · 5 naljepnica"],
    [0, 0, "0 naučenih riječi · 0 naljepnica"],
    [11, 12, "11 naučenih riječi · 12 naljepnica"],
    [21, 22, "21 naučena riječ · 22 naljepnice"],
    [40, 111, "40 naučenih riječi · 111 naljepnica"],
  ])(
    "says %i words and %i stickers with the Montenegrin plurals",
    (wordsLearned, stickers, text) => {
      expect(countsText({ wordsLearned, stickers })).toBe(text);
    },
  );
});
