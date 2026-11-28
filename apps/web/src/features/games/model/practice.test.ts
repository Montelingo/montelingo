import { describe, expect, it } from "vitest";

import { canDealMatchGame, createMatchGame } from "./match";
import { canDealMemoryGame, createMemoryGame, PAIRS } from "./memory";
import { PRACTICE_ROUNDS, type PracticeWord, practiceWords } from "./practice";
import { seeded } from "./test-random";

function word(
  id: string,
  text: string,
  imageUrl: string | null = `/w/${id}.webp`,
): PracticeWord {
  return { id, text, imageUrl, imageUrl512: null };
}

/** A place of `count` words, `prefix-1` to `prefix-count`, each with a picture. */
function place(prefix: string, count: number) {
  return {
    words: Array.from({ length: count }, (_, i) =>
      word(`${prefix}-${i + 1}`, `${prefix} ${i + 1}`),
    ),
  };
}

describe("practiceWords", () => {
  it("lists every place's words, in the places' order", () => {
    const words = practiceWords([place("budva", 2), place("tivat", 2)]);

    expect(words.map(({ id }) => id)).toEqual([
      "budva-1",
      "budva-2",
      "tivat-1",
      "tivat-2",
    ]);
  });

  it("lists a text once, the first one learned", () => {
    const budva = {
      words: [word("budva-riba", "riba"), word("budva-more", "more")],
    };
    const tivat = {
      words: [word("tivat-riba", " Riba "), word("tivat-brod", "brod")],
    };

    const words = practiceWords([budva, tivat]);

    expect(words.map(({ id }) => id)).toEqual([
      "budva-riba",
      "budva-more",
      "tivat-brod",
    ]);
  });

  it("keeps words without a picture", () => {
    const words = practiceWords([
      { words: [word("a", "a", null), word("b", "b", "")] },
    ]);

    expect(words.map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("keeps everything else about a word", () => {
    const learned = { ...word("a", "a"), lang: "cnr" };

    expect(practiceWords([{ words: [learned] }])).toEqual([learned]);
  });

  it("is empty without places", () => {
    expect(practiceWords([])).toEqual([]);
  });
});

describe("the games on the practice list", () => {
  const EIGHT_PLACES = Array.from({ length: 8 }, (_, i) => place(`p${i}`, 10));

  it(`plays ${PRACTICE_ROUNDS} match rounds and ${PAIRS} memory pairs from eight places`, () => {
    const words = practiceWords(EIGHT_PLACES);

    expect(canDealMatchGame(words)).toBe(true);
    expect(canDealMemoryGame(words)).toBe(true);
    expect(
      createMatchGame(words, seeded(1), { rounds: PRACTICE_ROUNDS })?.rounds,
    ).toHaveLength(PRACTICE_ROUNDS);
    expect(createMemoryGame(words, seeded(1))?.cards).toHaveLength(PAIRS * 2);
  });

  it("deals neither game from a list too small", () => {
    // Two places, but the same two words: one list of two words.
    const words = practiceWords([
      { words: [word("a1", "riba"), word("a2", "more")] },
      { words: [word("b1", "riba"), word("b2", "more")] },
    ]);

    expect(words).toHaveLength(2);
    expect(canDealMatchGame(words)).toBe(false);
    expect(canDealMemoryGame(words)).toBe(false);
  });
});
