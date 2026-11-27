import { describe, expect, it } from "vitest";

import { heartsText } from "./hearts";

describe("heartsText", () => {
  it.each([
    [1, "+1 srce"],
    [2, "+2 srca"],
    [4, "+4 srca"],
    [5, "+5 srca"],
    [11, "+11 srca"],
    [21, "+21 srce"],
  ])("says %i hearts in Montenegrin's forms", (count, text) => {
    expect(heartsText(count)).toBe(text);
  });
});
