import { describe, expect, it } from "vitest";

import { canDealMatchGame, createMatchGame } from "./match";
import { canDealMemoryGame } from "./memory";
import { PRACTICE_ROUNDS, practiceWords } from "./practice";

type Word = { id: string; text: string; imageUrl: string | null };

function word(
  id: string,
  text: string,
  imageUrl: string | null = `/w/${id}.webp`,
): Word {
  return { id, text, imageUrl };
}

describe("practiceWords", () => {
  it("puts every place's words in one list, in order", () => {
    const words = practiceWords([
      { words: [word("1", "more"), word("2", "pijesak")] },
      { words: [word("41", "palma")] },
    ]);

    expect(words.map(({ id }) => id)).toEqual(["1", "2", "41"]);
  });

  it("keeps one word per text, the first one learned", () => {
    const words = practiceWords([
      { words: [word("3", "riba")] },
      { words: [word("44", "Riba "), word("45", "brod")] },
    ]);

    expect(words.map(({ id }) => id)).toEqual(["3", "45"]);
  });

  it("keeps words without a picture: each game skips them itself", () => {
    const words = practiceWords([
      { words: [word("1", "more", null), word("2", "pijesak")] },
    ]);

    expect(words.map(({ id }) => id)).toEqual(["1", "2"]);
  });

  it("is empty without places", () => {
    expect(practiceWords([])).toEqual([]);
  });

  it("deals both games from words of several places", () => {
    const words = practiceWords([
      { words: [word("1", "more"), word("2", "pijesak")] },
      { words: [word("41", "palma"), word("42", "jedro")] },
    ]);

    expect(canDealMemoryGame(words)).toBe(true);
    expect(canDealMatchGame(words)).toBe(true);
  });

  it("deals neither game from a list too small", () => {
    const words = practiceWords([
      { words: [word("1", "more"), word("2", "pijesak")] },
    ]);

    expect(canDealMemoryGame(words)).toBe(false);
    expect(canDealMatchGame(words)).toBe(false);
  });

  it("keeps a later copy that has a picture over an earlier one without", () => {
    const words = practiceWords([
      { words: [word("3", "riba", null)] },
      { words: [word("44", "riba"), word("45", "riba")] },
    ]);

    expect(words.map(({ id }) => id)).toEqual(["44"]);
  });

  it("deals PRACTICE_ROUNDS match rounds from many words", () => {
    const words = practiceWords(
      Array.from({ length: 3 }, (_, place) => ({
        words: Array.from({ length: 10 }, (_, i) =>
          word(`${place}-${i}`, `word ${place}-${i}`),
        ),
      })),
    );

    const game = createMatchGame(words, () => 0.5, { rounds: PRACTICE_ROUNDS });

    expect(words).toHaveLength(30);
    expect(game?.rounds).toHaveLength(10);
  });
});
