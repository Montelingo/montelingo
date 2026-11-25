import { describe, expect, it } from "vitest";

import { seededRandom } from "../test-random";
import {
  DIGIT_COUNT,
  HOLD_MS,
  drawPuzzle,
  holdProgress,
  isHoldComplete,
  isTarget,
  numberWord,
} from "./gate";

describe("drawPuzzle", () => {
  it.each([1, 2, 3, 42, 2024])(
    "draws four different digits from 1 to 9, the target among them (seed %i)",
    (seed) => {
      const { digits, target } = drawPuzzle(seededRandom(seed));

      expect(digits).toHaveLength(DIGIT_COUNT);
      expect(new Set(digits).size).toBe(DIGIT_COUNT);
      for (const digit of digits) {
        expect(digit).toBeGreaterThanOrEqual(1);
        expect(digit).toBeLessThanOrEqual(9);
      }
      expect(digits).toContain(target);
    },
  );

  it("draws the same puzzle from the same random source", () => {
    expect(drawPuzzle(seededRandom(7))).toEqual(drawPuzzle(seededRandom(7)));
  });

  it("can ask for the first or the last digit it shows", () => {
    expect(drawPuzzle(() => 0).target).toBe(drawPuzzle(() => 0).digits[0]);
    const last = drawPuzzle(() => 0.999);
    expect(last.target).toBe(last.digits[DIGIT_COUNT - 1]);
  });

  it("draws every digit over many puzzles", () => {
    const random = seededRandom(5);
    const seen = new Set<number>();
    for (let i = 0; i < 200; i += 1) {
      const { digits, target } = drawPuzzle(random);
      digits.forEach((digit) => seen.add(digit));
      seen.add(target);
    }

    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe("isTarget", () => {
  const puzzle = { digits: [3, 9, 1, 6], target: 9 };

  it("accepts the target", () => {
    expect(isTarget(puzzle, 9)).toBe(true);
  });

  it("rejects any other digit", () => {
    for (const digit of [3, 1, 6]) {
      expect(isTarget(puzzle, digit)).toBe(false);
    }
  });
});

describe("numberWord", () => {
  it.each([
    [1, "jedan"],
    [2, "dva"],
    [3, "tri"],
    [4, "četiri"],
    [5, "pet"],
    [6, "šest"],
    [7, "sedam"],
    [8, "osam"],
    [9, "devet"],
  ])("writes %i out as %s", (digit, word) => {
    expect(numberWord(digit)).toBe(word);
  });

  it.each([0, 10])("has no word for %i", (digit) => {
    expect(() => numberWord(digit)).toThrow(RangeError);
  });
});

describe("hold timing", () => {
  it("fills the ring over 1.5 seconds", () => {
    expect(HOLD_MS).toBe(1500);
    expect(holdProgress(0)).toBe(0);
    expect(holdProgress(750)).toBe(0.5);
    expect(holdProgress(1500)).toBe(1);
  });

  it("never fills past the ends", () => {
    expect(holdProgress(-10)).toBe(0);
    expect(holdProgress(4000)).toBe(1);
  });

  it("passes only once the hold is long enough", () => {
    expect(isHoldComplete(1499)).toBe(false);
    expect(isHoldComplete(1500)).toBe(true);
    expect(isHoldComplete(2000)).toBe(true);
  });
});
