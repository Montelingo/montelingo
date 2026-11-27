import { describe, expect, it } from "vitest";

import type { Profile } from "@/features/profile/edge";

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

function progressWith(wordsLearned: number, stickers: number): ProgressResult {
  return {
    status: "ready",
    progress: {
      regions: [],
      locations: [],
      chapters: [],
      counts: { wordsLearned, stickers, stars: 0 },
    },
  };
}

describe("toMeData", () => {
  it("shows the child with their buddy and title, and the server's counts", () => {
    expect(toMeData(progressWith(40, 1), MIA)).toEqual({
      explorer: {
        name: "Mia",
        avatar: "owl",
        title: "Istraživač · 5–6 godina",
      },
      counts: { wordsLearned: 40, stickers: 1, stars: 0 },
      needsRetry: false,
    });
  });

  it("shows the placeholder explorer, without a title, before the profile is set up", () => {
    const me = toMeData(progressWith(0, 0), NOT_SET_UP);

    expect(me.explorer).toEqual({
      name: "Istraživač",
      avatar: "fox",
      title: null,
    });
    expect(me.needsRetry).toBe(false);
  });

  it("shows the placeholder explorer and offers a retry when the profile failed", () => {
    const me = toMeData(progressWith(10, 0), null);

    expect(me.explorer.name).toBe("Istraživač");
    expect(me.counts).toEqual({ wordsLearned: 10, stickers: 0, stars: 0 });
    expect(me.needsRetry).toBe(true);
  });

  it("has no counts and offers a retry when progress failed", () => {
    const me = toMeData({ status: "error" }, MIA);

    expect(me.explorer.name).toBe("Mia");
    expect(me.counts).toBeNull();
    expect(me.needsRetry).toBe(true);
  });
});
