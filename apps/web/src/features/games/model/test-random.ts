import type { Random } from "@/lib/random";

/**
 * A repeatable random source for the games' tests (a Park–Miller generator):
 * the same seed gives the same sequence, so a deal repeats.
 */
export function seeded(seed: number): Random {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}
