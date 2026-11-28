import { describe, expect, it } from "vitest";

import type { Player, Profile } from "@/features/profile/edge";

import { toMeData } from "./me";
import type { ProgressResult } from "./progress";

const MIA: Profile = {
  name: "Mia",
  ageBand: "5-6",
  avatar: "owl",
  isComplete: true,
};

const NOT_SET_UP: Profile = {
  name: null,
  ageBand: null,
  avatar: null,
  isComplete: false,
};

// The account's one player, Mia, and a second one, Leo.
const MIA_PLAYER: Player = { ...MIA, id: "player-mia", isActive: true };
const LEO_PLAYER: Player = {
  ...MIA,
  name: "Leo",
  avatar: "bear",
  id: "player-leo",
  isActive: false,
};

function progressWith(wordsLearned: number, stickers: number): ProgressResult {
  return {
    status: "ready",
    progress: {
      regions: [],
      locations: [],
      chapters: [],
      counts: { wordsLearned, stickers, stars: 0, hearts: 0 },
    },
  };
}

describe("toMeData", () => {
  it("shows the child with their buddy and title, and the server's counts", () => {
    expect(toMeData(progressWith(40, 1), MIA, [MIA_PLAYER])).toEqual({
      explorer: {
        name: "Mia",
        avatar: "owl",
        title: "Istraživač · 5–6 godina",
      },
      counts: { wordsLearned: 40, stickers: 1, stars: 0, hearts: 0 },
      needsRetry: false,
      canSwitchPlayer: false,
    });
  });

  it("shows the placeholder explorer, without a title, before the profile is set up", () => {
    const me = toMeData(progressWith(0, 0), NOT_SET_UP, [MIA_PLAYER]);

    expect(me.explorer).toEqual({
      name: "Istraživač",
      avatar: "fox",
      title: null,
    });
    expect(me.needsRetry).toBe(false);
  });

  it("shows the placeholder explorer and offers a retry when the profile failed", () => {
    const me = toMeData(progressWith(10, 0), null, [MIA_PLAYER]);

    expect(me.explorer.name).toBe("Istraživač");
    expect(me.counts).toEqual({
      wordsLearned: 10,
      stickers: 0,
      stars: 0,
      hearts: 0,
    });
    expect(me.needsRetry).toBe(true);
  });

  it("has no counts and offers a retry when progress failed", () => {
    const me = toMeData({ status: "error" }, MIA, [MIA_PLAYER]);

    expect(me.explorer.name).toBe("Mia");
    expect(me.counts).toBeNull();
    expect(me.needsRetry).toBe(true);
  });

  it("offers Switch player when the account has another player", () => {
    const me = toMeData(progressWith(0, 0), MIA, [MIA_PLAYER, LEO_PLAYER]);

    expect(me.canSwitchPlayer).toBe(true);
  });

  it("does not offer Switch player, nor a retry, when the players failed", () => {
    const me = toMeData(progressWith(0, 0), MIA, null);

    expect(me.canSwitchPlayer).toBe(false);
    expect(me.needsRetry).toBe(false);
  });
});
