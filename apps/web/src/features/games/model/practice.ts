// Practice from the Riječi tab (#233, #237): the chapter games, dealt from
// every word the child has learned instead of one chapter's ten. Pure
// functions, no React: the practice routes (#235) build the list here and
// hand it to the games as a chapter's words.

import { textKey } from "./match";

/**
 * How many match rounds a practice game plays, from all the learned words.
 * Memory needs no cap: it already deals `PAIRS` at random. Tune after testing
 * with children.
 */
export const PRACTICE_ROUNDS = 10;

/**
 * One word list from the learned places, in their order. Each text is played
 * once, so a word learned in two places ("riba" in Budva and in Tivat) is
 * practised once, not once per place. The first copy learned is kept, unless
 * only a later one has a picture: then that one, so the word is still played.
 * Words without any picture stay, since each game skips them itself.
 */
export function practiceWords<
  Word extends { text: string; imageUrl: string | null },
>(places: readonly { words: readonly Word[] }[]): Word[] {
  const result: Word[] = [];
  const indexByText = new Map<string, number>();
  for (const word of places.flatMap((place) => place.words)) {
    const key = textKey(word.text);
    const index = indexByText.get(key);
    if (index === undefined) {
      indexByText.set(key, result.length);
      result.push(word);
    } else if (!result[index]?.imageUrl && word.imageUrl) {
      result[index] = word;
    }
  }
  return result;
}
