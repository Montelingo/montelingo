import { describe, expect, it } from "vitest";

import {
  type MemoryState,
  type MemoryWord,
  MIN_PAIRS,
  PAIRS,
  canDealMemoryGame,
  cardFace,
  createMemoryGame,
  isComplete,
  isMissShowing,
  memoryReducer,
} from "./memory";

function word(n: number, imageUrl: string | null = `/w/${n}.webp`): MemoryWord {
  return { id: `word-${n}`, text: `word ${n}`, imageUrl };
}

const TEN_WORDS = Array.from({ length: 10 }, (_, i) => word(i + 1));

/** A repeatable random source: the same seed gives the same sequence. */
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function newGame(words: readonly MemoryWord[] = TEN_WORDS, seed = 1) {
  const game = createMemoryGame(words, seeded(seed));
  if (game === null) {
    throw new Error("expected a game");
  }
  return game;
}

/** The two card ids of one pair, and a card id from another pair. */
function pairAndOther(state: MemoryState) {
  const [first] = state.cards;
  if (first === undefined) {
    throw new Error("expected cards");
  }
  const partner = state.cards.find(
    (card) => card.wordId === first.wordId && card.id !== first.id,
  );
  const other = state.cards.find((card) => card.wordId !== first.wordId);
  if (partner === undefined || other === undefined) {
    throw new Error("expected a pair and another card");
  }
  return { a: first.id, b: partner.id, other: other.id };
}

function flip(state: MemoryState, ...cardIds: string[]): MemoryState {
  return cardIds.reduce(
    (current, cardId) => memoryReducer(current, { type: "flip", cardId }),
    state,
  );
}

describe("createMemoryGame", () => {
  it(`deals ${PAIRS} pairs: each chosen word twice, with its picture`, () => {
    const game = newGame();

    expect(game.cards).toHaveLength(PAIRS * 2);
    const counts = new Map<string, number>();
    for (const card of game.cards) {
      counts.set(card.wordId, (counts.get(card.wordId) ?? 0) + 1);
      expect(card.imageUrl).toBe(`/w/${card.wordId.slice(5)}.webp`);
    }
    expect(counts.size).toBe(PAIRS);
    expect([...counts.values()].every((count) => count === 2)).toBe(true);
  });

  it("gives every card its own id", () => {
    const ids = newGame().cards.map((card) => card.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("leaves out words without a picture", () => {
    const words = [
      ...TEN_WORDS.slice(0, 4),
      word(5, null),
      word(6, null),
      word(7, null),
    ];

    const game = newGame(words);

    expect(game.cards).toHaveLength(8);
    expect(new Set(game.cards.map((card) => card.wordId))).toEqual(
      new Set(["word-1", "word-2", "word-3", "word-4"]),
    );
  });

  it("treats an empty picture URL as no picture", () => {
    const words = [...TEN_WORDS.slice(0, 2), word(3, ""), word(4, "")];

    expect(createMemoryGame(words, seeded(1))).toBeNull();
  });

  it("deals a word only once, even if it is listed twice", () => {
    const words = [...TEN_WORDS.slice(0, 3), word(1), word(2)];

    const game = newGame(words);

    expect(game.cards).toHaveLength(6);
    expect(new Set(game.cards.map((card) => card.id)).size).toBe(6);
  });

  it("deals a picture only once, so a pair always looks alike and only it", () => {
    const shared = "/w/shared.webp";
    const words = [...TEN_WORDS.slice(0, 3), word(4, shared), word(5, shared)];

    const game = newGame(words);
    const pictures = game.cards.map((card) => card.imageUrl);

    expect(game.cards).toHaveLength(8);
    expect(pictures.filter((url) => url === shared)).toHaveLength(2);
  });

  it("plays with three pairs, the fewest", () => {
    expect(newGame(TEN_WORDS.slice(0, 3)).cards).toHaveLength(6);
  });

  it("has no game with fewer than three pictures", () => {
    const words = [...TEN_WORDS.slice(0, 2), word(3, null), word(4, null)];

    expect(createMemoryGame(words, seeded(1))).toBeNull();
    expect(createMemoryGame([], seeded(1))).toBeNull();
  });

  it("starts with every card face down", () => {
    const game = newGame();

    expect(game.faceUp).toEqual([]);
    expect(game.matched).toEqual([]);
    expect(game.cards.every((card) => cardFace(game, card.id) === "down")).toBe(
      true,
    );
  });

  it("deals the same game from the same random source", () => {
    expect(newGame(TEN_WORDS, 7)).toEqual(newGame(TEN_WORDS, 7));
  });

  it("shuffles the cards and the chosen words with the random source", () => {
    const games = [1, 2, 3, 4, 5].map((seed) => newGame(TEN_WORDS, seed));
    const orders = new Set(
      games.map((game) => game.cards.map((card) => card.id).join()),
    );
    const wordSets = new Set(
      games.map((game) =>
        [...new Set(game.cards.map((card) => card.wordId))].sort().join(),
      ),
    );

    expect(orders.size).toBeGreaterThan(1);
    expect(wordSets.size).toBeGreaterThan(1);
  });
});

describe("memoryReducer", () => {
  it("turns a face-down card over", () => {
    const game = newGame();
    const { a } = pairAndOther(game);

    const state = flip(game, a);

    expect(state.faceUp).toEqual([a]);
    expect(cardFace(state, a)).toBe("up");
  });

  it("keeps a found pair up and clears the turned cards", () => {
    const game = newGame();
    const { a, b } = pairAndOther(game);

    const state = flip(game, a, b);

    expect(state.faceUp).toEqual([]);
    expect(cardFace(state, a)).toBe("matched");
    expect(cardFace(state, b)).toBe("matched");
    expect(isMissShowing(state)).toBe(false);
  });

  it("shows a miss until it is hidden, and turns nothing else meanwhile", () => {
    const game = newGame();
    const { a, b, other } = pairAndOther(game);

    const missed = flip(game, a, other);

    expect(isMissShowing(missed)).toBe(true);
    expect(flip(missed, b)).toBe(missed);

    const hidden = memoryReducer(missed, { type: "hide-miss" });

    expect(hidden.faceUp).toEqual([]);
    expect(cardFace(hidden, a)).toBe("down");
    expect(cardFace(hidden, other)).toBe("down");
  });

  it("ignores a card that is already up, already found, or unknown", () => {
    const game = newGame();
    const { a, b, other } = pairAndOther(game);

    const oneUp = flip(game, a);
    expect(flip(oneUp, a)).toBe(oneUp);

    const found = flip(game, a, b);
    expect(flip(found, a)).toBe(found);

    expect(flip(game, "no-such-card")).toBe(game);
    expect(flip(found, other).faceUp).toEqual([other]);
  });

  it("does nothing when hiding a miss that is not showing", () => {
    const game = newGame();
    const { a } = pairAndOther(game);
    const oneUp = flip(game, a);

    expect(memoryReducer(game, { type: "hide-miss" })).toBe(game);
    expect(memoryReducer(oneUp, { type: "hide-miss" })).toBe(oneUp);
  });
});

describe("isComplete", () => {
  it("is true once every pair is found, and not before", () => {
    let state = newGame();
    const wordIds = [...new Set(state.cards.map((card) => card.wordId))];

    for (const wordId of wordIds) {
      expect(isComplete(state)).toBe(false);
      const pair = state.cards.filter((card) => card.wordId === wordId);
      state = flip(state, ...pair.map((card) => card.id));
    }

    expect(isComplete(state)).toBe(true);
  });

  it("is false for a game with no cards", () => {
    expect(isComplete({ cards: [], faceUp: [], matched: [] })).toBe(false);
  });
});

describe("canDealMemoryGame", () => {
  it(`deals with ${MIN_PAIRS} words that have pictures`, () => {
    const words = [
      ...TEN_WORDS.slice(0, MIN_PAIRS),
      word(20, null),
      word(21, null),
    ];

    expect(canDealMemoryGame(words)).toBe(true);
  });

  it("does not deal with fewer distinct pictures, as createMemoryGame does not", () => {
    // Two words share a picture, so only MIN_PAIRS - 1 pictures are distinct.
    const words = [
      ...TEN_WORDS.slice(0, MIN_PAIRS - 1),
      word(30, TEN_WORDS[0]?.imageUrl ?? null),
      word(31, null),
    ];

    expect(canDealMemoryGame(words)).toBe(false);
    expect(createMemoryGame(words, Math.random)).toBeNull();
  });
});
