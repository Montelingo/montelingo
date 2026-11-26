// The grown-ups gate's puzzle (#177): press and hold the digit whose number
// is written out in words. A child who cannot read yet cannot pass it. It is
// a speed bump, not security: the session already decides who may see the
// grown-ups area. Pure functions, no React; the dialog draws with an
// injected random source, so a test's puzzle repeats.

import { type Random, shuffle } from "@/lib/random";

/** How many digits the gate offers: the target and three others. */
export const DIGIT_COUNT = 4;

/** How long the target must be held, in milliseconds. */
export const HOLD_MS = 1500;

/** The digits 1 to 9, written out, for the gate's heading. */
const NUMBER_WORDS = [
  "jedan",
  "dva",
  "tri",
  "četiri",
  "pet",
  "šest",
  "sedam",
  "osam",
  "devet",
] as const;

const DIGITS = NUMBER_WORDS.map((_, index) => index + 1);

export type GatePuzzle = {
  /** `DIGIT_COUNT` different digits from 1 to 9, in random order. */
  digits: readonly number[];
  /** The digit to hold: one of `digits`. */
  target: number;
};

/** A new puzzle: four different digits in random order, one the target. */
export function drawPuzzle(random: Random): GatePuzzle {
  const digits = shuffle(DIGITS, random).slice(0, DIGIT_COUNT);
  const target = digits[Math.floor(random() * digits.length)] as number;
  return { digits, target };
}

/** Whether `digit` is the one the puzzle asks for. */
export function isTarget(puzzle: GatePuzzle, digit: number): boolean {
  return digit === puzzle.target;
}

/** A digit from 1 to 9 written out ("devet"). */
export function numberWord(digit: number): string {
  const word = NUMBER_WORDS[digit - 1];
  if (word === undefined) {
    throw new RangeError(`No number word for ${digit}`);
  }
  return word;
}

/** How far a hold of `elapsedMs` has filled the ring, from 0 to 1. */
export function holdProgress(elapsedMs: number): number {
  return Math.min(Math.max(elapsedMs / HOLD_MS, 0), 1);
}

/** Whether a hold of `elapsedMs` is long enough to pass the gate. */
export function isHoldComplete(elapsedMs: number): boolean {
  return elapsedMs >= HOLD_MS;
}
