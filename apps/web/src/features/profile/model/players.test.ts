import { describe, expect, it } from "vitest";

import {
  canAddPlayer,
  canSwitchPlayer,
  type Player,
  playerLook,
  toPlayer,
} from "./players";

const MIA: Player = {
  id: "player-mia",
  name: "Mia",
  ageBand: "5-6",
  avatar: "owl",
  isComplete: true,
  isActive: true,
};

describe("toPlayer", () => {
  it("is the profile with the player's id and whether they play", () => {
    expect(
      toPlayer({
        id: "player-mia",
        name: "Mia",
        age_band: "5-6",
        avatar: "owl",
        is_complete: true,
        is_active: true,
      }),
    ).toEqual(MIA);
  });
});

describe("canSwitchPlayer", () => {
  it("needs a second player to switch to", () => {
    expect(canSwitchPlayer([])).toBe(false);
    expect(canSwitchPlayer([MIA])).toBe(false);
    expect(canSwitchPlayer([MIA, { ...MIA, id: "p2", isActive: false }])).toBe(
      true,
    );
  });
});

describe("canAddPlayer", () => {
  it("allows up to four players", () => {
    const players = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...MIA,
        id: `p${index}`,
      }));
    expect(canAddPlayer(players(1))).toBe(true);
    expect(canAddPlayer(players(3))).toBe(true);
    expect(canAddPlayer(players(4))).toBe(false);
  });
});

describe("playerLook", () => {
  it("is the player's name and buddy", () => {
    expect(playerLook(MIA)).toEqual({ name: "Mia", avatar: "owl" });
  });

  it("is the placeholder explorer's before setup", () => {
    expect(
      playerLook({ ...MIA, name: null, avatar: null, isComplete: false }),
    ).toEqual({ name: "Istraživač", avatar: "fox" });
  });
});
