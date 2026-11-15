import { describe, expect, it } from "vitest";

import {
  AGE_BANDS,
  AVATARS,
  avatarSrc,
  type Profile,
  toExplorer,
  toProfile,
} from "./profile";

const MIA: Profile = {
  name: "Mia",
  ageBand: "5-6",
  avatar: "owl",
  isComplete: true,
};

describe("toProfile", () => {
  it("maps the API's profile", () => {
    expect(
      toProfile({
        name: "Mia",
        age_band: "5-6",
        avatar: "owl",
        is_complete: true,
      }),
    ).toEqual(MIA);
  });

  it("keeps a profile that is not set up yet", () => {
    expect(
      toProfile({
        name: null,
        age_band: null,
        avatar: null,
        is_complete: false,
      }),
    ).toEqual({ name: null, ageBand: null, avatar: null, isComplete: false });
  });
});

describe("toExplorer", () => {
  it.each([
    ["3-4", "Mali istraživač · 3–4 godine"],
    ["5-6", "Istraživač · 5–6 godina"],
    ["7", "Veliki istraživač · 7 godina"],
  ] as const)("titles a child aged %s", (ageBand, title) => {
    expect(toExplorer({ ...MIA, ageBand })).toEqual({
      name: "Mia",
      avatar: "owl",
      title,
    });
  });

  it("has no explorer until the profile is complete", () => {
    expect(toExplorer({ ...MIA, isComplete: false })).toBeNull();
    expect(
      toExplorer({
        name: null,
        ageBand: null,
        avatar: null,
        isComplete: false,
      }),
    ).toBeNull();
  });
});

describe("the choices", () => {
  it("lists the six buddies in the Figma order, each with its picture", () => {
    expect(AVATARS.map(({ id }) => id)).toEqual([
      "fox",
      "bear",
      "bunny",
      "frog",
      "owl",
      "cat",
    ]);
    expect(avatarSrc("frog")).toBe("/learner/avatar-frog.svg");
  });

  it("lists the three age bands, youngest first", () => {
    expect(AGE_BANDS.map(({ id }) => id)).toEqual(["3-4", "5-6", "7"]);
  });
});
