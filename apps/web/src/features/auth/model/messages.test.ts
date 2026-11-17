import { describe, expect, it } from "vitest";

import { fixBelow } from "./messages";

describe("fixBelow", () => {
  it.each([
    [1, "Ispravi 1 stvar ispod"],
    [2, "Ispravi 2 stvari ispod"],
    [4, "Ispravi 4 stvari ispod"],
    [5, "Ispravi 5 stvari ispod"],
    [11, "Ispravi 11 stvari ispod"],
    [21, "Ispravi 21 stvar ispod"],
    [22, "Ispravi 22 stvari ispod"],
  ])("says how many things to fix for %i", (count, line) => {
    expect(fixBelow(count)).toBe(line);
  });
});
