import { describe, expect, it } from "vitest";

import {
  initialOf,
  PLACEHOLDER_ART_PALETTE_COUNT,
  PLACEHOLDER_ART_PATTERNS,
  PLACEHOLDER_ART_ROTATIONS,
  placeholderArt,
} from "./placeholder-art";

const ids = Array.from({ length: 200 }, (_, index) => `place-${index}`);

describe("placeholderArt", () => {
  it("gives the same picture for the same ID every time", () => {
    expect(placeholderArt("kotor", "Kotor")).toEqual(
      placeholderArt("kotor", "Kotor"),
    );
  });

  // Pinned, so a change to the hash (which would change every town's look)
  // is a deliberate one.
  it.each([
    ["kotor", { palette: 0, pattern: "waves", rotation: 45 }],
    ["budva", { palette: 5, pattern: "waves", rotation: 135 }],
    ["zabljak", { palette: 0, pattern: "stripes", rotation: 90 }],
  ])("draws %j the same way as before", (id, expected) => {
    expect(placeholderArt(id)).toMatchObject(expected);
  });

  it("treats the composed and decomposed spellings of an ID as one", () => {
    expect(placeholderArt("žabljak")).toEqual(placeholderArt("žabljak"));
  });

  it("spreads IDs across every palette, pattern, and rotation", () => {
    const specs = ids.map((id) => placeholderArt(id));

    expect(new Set(specs.map((spec) => spec.palette)).size).toBe(
      PLACEHOLDER_ART_PALETTE_COUNT,
    );
    expect(new Set(specs.map((spec) => spec.pattern)).size).toBe(
      PLACEHOLDER_ART_PATTERNS.length,
    );
    expect(new Set(specs.map((spec) => spec.rotation)).size).toBe(
      PLACEHOLDER_ART_ROTATIONS.length,
    );
  });

  it("stays within the palettes", () => {
    for (const id of ids) {
      const { palette } = placeholderArt(id);
      expect(palette).toBeGreaterThanOrEqual(0);
      expect(palette).toBeLessThan(PLACEHOLDER_ART_PALETTE_COUNT);
    }
  });

  it("takes the initial from the label", () => {
    expect(placeholderArt("town-17", "Kotor").initial).toBe("K");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["blank", "   "],
  ])("takes the initial from the ID when the label is %s", (_case, label) => {
    expect(placeholderArt("budva", label).initial).toBe("B");
  });

  it("keeps the picture when only the label changes", () => {
    const original = placeholderArt("kotor", "Kotor");
    const renamed = placeholderArt("kotor", "Cattaro");

    expect(renamed).toEqual({ ...original, initial: "C" });
  });
});

describe("initialOf", () => {
  it.each([
    ["Kotor", "K"],
    ["budva", "B"],
    ["  Bar", "B"],
    ["Žabljak", "Ž"],
    ["žabljak", "Ž"],
    // z + combining caron, composed to ž first
    ["žabljak", "Ž"],
    ["Nikšić", "N"],
    ["Šavnik", "Š"],
    ["Čanj", "Č"],
    ["Ćemovsko polje", "Ć"],
    ["Đurđevića Tara", "Đ"],
    ["Ulcinj", "U"],
    ["Herceg Novi", "H"],
    ["9 Lakes", "9"],
    ["🏰 Castle", "🏰"],
    ["", ""],
    ["   ", ""],
  ])("%j starts with %j", (text, expected) => {
    expect(initialOf(text)).toBe(expected);
  });

  it.each([
    ["Ljubović", "Lj"],
    ["ljubović", "Lj"],
    ["LJUBOVIĆ", "Lj"],
    ["lJubović", "Lj"],
    ["Njeguši", "Nj"],
    ["njeguši", "Nj"],
    ["NJEGUŠI", "Nj"],
    ["Džamija", "Dž"],
    ["džamija", "Dž"],
    ["DŽAMIJA", "Dž"],
    // d + z + combining caron
    ["džamija", "Dž"],
    // the single-character digraphs ǅ, ǈ, ǋ
    ["ǅamija", "Dž"],
    ["ǈubović", "Lj"],
    ["ǋeguši", "Nj"],
  ])("treats the digraph in %j as one letter, %j", (text, expected) => {
    expect(initialOf(text)).toBe(expected);
  });

  it.each([
    ["Lovćen", "L"],
    ["Novi", "N"],
    ["Danilovgrad", "D"],
    ["Dzeta", "D"],
  ])("does not mistake %j for a digraph", (text, expected) => {
    expect(initialOf(text)).toBe(expected);
  });
});
