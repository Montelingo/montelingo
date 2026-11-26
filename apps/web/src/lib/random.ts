// Randomness, injected so a test repeats: the games deal and the grown-ups
// gate draws its puzzle with it.

/** A random number in [0, 1), like `Math.random`, injected so tests repeat. */
export type Random = () => number;

/** A shuffled copy (Fisher–Yates), drawing from `random`. */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const item = result[i] as T;
    result[i] = result[j] as T;
    result[j] = item;
  }
  return result;
}
