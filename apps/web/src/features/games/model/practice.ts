// Practice (#233, part of #237): the games played with every word the child
// has learned, not one chapter's ten. Pure functions, no React. The memory
// game already deals `PAIRS` at random from any list; match takes
// `PRACTICE_ROUNDS` as its cap, or a child who has finished eight places
// would play eighty rounds.

import { type MatchWord, textKey } from "./match";
import { type MemoryWord } from "./memory";

/** How many rounds a practice match plays, at most. Tune after testing with children. */
export const PRACTICE_ROUNDS = 10;

/** What practice needs of a word: what both games need. */
export type PracticeWord = MatchWord & MemoryWord;

/** What practice needs of a learned place: its words. */
export type PracticePlace<W extends PracticeWord = PracticeWord> = {
  words: readonly W[];
};

/**
 * One list of every learned word, for either game to deal from. Each text
 * comes once, read as match compares texts: "riba" learned in Budva and in
 * Tivat would otherwise be two words with two pictures, and either picture
 * would be right for either word. The first one learned wins, and the places
 * come in the order the map opens them.
 *
 * Words without a picture stay: match offers them as wrong words, and each
 * game already leaves them out of its pictures.
 */
export function practiceWords<W extends PracticeWord>(
  places: readonly PracticePlace<W>[],
): readonly W[] {
  const seen = new Set<string>();
  const result: W[] = [];
  for (const word of places.flatMap((place) => place.words)) {
    const key = textKey(word.text);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(word);
  }
  return result;
}
