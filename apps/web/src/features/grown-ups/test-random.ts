import type { Random } from "@/lib/random";

/**
 * A repeatable random source for tests (a Park–Miller generator): two built
 * from the same seed give the same numbers, so a test can draw the puzzles
 * the dialog will draw.
 */
export function seededRandom(seed: number): Random {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
