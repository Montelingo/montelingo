import { describe, expect, it } from "vitest";

import {
  canDealMatchGame,
  createMatchGame,
  currentRound,
  isComplete,
  type MatchRound,
  type MatchState,
  type MatchWord,
  matchReducer,
  OPTIONS,
} from "./match";

function word(n: number, imageUrl: string | null = `/w/${n}.webp`): MatchWord {
  return { id: `word-${n}`, text: `word ${n}`, imageUrl };
}

const SIX_WORDS = Array.from({ length: 6 }, (_, i) => word(i + 1));

/** A repeatable random source: the same seed gives the same sequence. */
function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function newGame(words: readonly MatchWord[] = SIX_WORDS, seed = 1) {
  const game = createMatchGame(words, seeded(seed));
  if (game === null) {
    throw new Error("expected a game");
  }
  return game;
}

function roundOf(state: MatchState): MatchRound {
  const round = currentRound(state);
  if (round === null) {
    throw new Error("expected a round");
  }
  return round;
}

/** A word on offer this round that is not the right one. */
function wrongWordOf(state: MatchState, index = 0): string {
  const round = roundOf(state);
  const wrong = round.options.filter(
    (option) => option.wordId !== round.wordId,
  )[index];
  if (wrong === undefined) {
    throw new Error("expected a wrong word");
  }
  return wrong.wordId;
}

function pick(state: MatchState, wordId: string): MatchState {
  return matchReducer(state, { type: "pick", wordId });
}

/** The right word, then on to the next round. */
function solve(state: MatchState): MatchState {
  return matchReducer(pick(state, roundOf(state).wordId), { type: "next" });
}

describe("createMatchGame", () => {
  it("deals a round for every word with a picture, each once", () => {
    const game = newGame();

    expect(game.rounds.map((round) => round.wordId).sort()).toEqual(
      SIX_WORDS.map(({ id }) => id).sort(),
    );
    for (const round of game.rounds) {
      expect(round.imageUrl).toBe(`/w/${round.wordId.slice(5)}.webp`);
    }
  });

  it(`offers ${OPTIONS} different words, the right one among them`, () => {
    for (const round of newGame().rounds) {
      const ids = round.options.map((option) => option.wordId);
      expect(ids).toHaveLength(OPTIONS);
      expect(new Set(ids).size).toBe(OPTIONS);
      expect(ids).toContain(round.wordId);
    }
  });

  it("writes each option as its word", () => {
    for (const round of newGame().rounds) {
      for (const option of round.options) {
        expect(option.text).toBe(`word ${option.wordId.slice(5)}`);
      }
    }
  });

  it("puts the rounds and the right word's place in random order", () => {
    const orders = new Set<string>();
    const places = new Set<number>();
    for (let seed = 1; seed <= 20; seed += 1) {
      const game = newGame(SIX_WORDS, seed);
      orders.add(game.rounds.map((round) => round.wordId).join());
      for (const round of game.rounds) {
        places.add(
          round.options.findIndex((option) => option.wordId === round.wordId),
        );
      }
    }

    expect(orders.size).toBeGreaterThan(1);
    expect(places).toEqual(new Set([0, 1, 2]));
  });

  it("deals the same game from the same random source", () => {
    expect(newGame(SIX_WORDS, 7)).toEqual(newGame(SIX_WORDS, 7));
  });

  it("starts on the first round, with nothing picked", () => {
    const game = newGame();

    expect(game.current).toBe(0);
    expect(game.wrong).toEqual([]);
    expect(game.isSolved).toBe(false);
  });

  it("shows no round for a word without a picture, but may offer it", () => {
    const words = [word(1), word(2), word(3, null), word(4, "")];
    const game = newGame(words);

    expect(game.rounds.map((round) => round.wordId).sort()).toEqual([
      "word-1",
      "word-2",
    ]);
    for (const round of game.rounds) {
      expect(round.options).toHaveLength(OPTIONS);
    }
  });

  it("never offers a second word that reads the same as the right one", () => {
    const words = [
      word(1),
      { id: "word-1b", text: " Word 1 ", imageUrl: null },
      word(2, null),
      word(3, null),
    ];

    const [round] = newGame(words).rounds;

    expect(round?.options.map((option) => option.wordId)).not.toContain(
      "word-1b",
    );
  });

  it("shows no picture two words share, since both would be right", () => {
    const words = [word(1, "/w/same.webp"), word(2, "/w/same.webp"), word(3)];
    const game = createMatchGame([...words, word(4), word(5)], seeded(1));

    expect(game?.rounds.map((round) => round.wordId).sort()).toEqual([
      "word-3",
      "word-4",
      "word-5",
    ]);
  });

  it("deals a word only once, even if it is listed twice", () => {
    const game = newGame([word(1), word(1), word(2), word(3)]);

    expect(game.rounds).toHaveLength(3);
  });

  it("has no game without a picture, or with fewer than three words", () => {
    expect(createMatchGame([], seeded(1))).toBeNull();
    expect(createMatchGame([word(1), word(2)], seeded(1))).toBeNull();
    expect(
      createMatchGame([word(1, null), word(2, null), word(3, null)], seeded(1)),
    ).toBeNull();
  });
});

describe("matchReducer", () => {
  it("sets a wrong word aside and stays on the round", () => {
    const game = newGame();
    const wrong = wrongWordOf(game);

    const after = pick(game, wrong);

    expect(after.current).toBe(0);
    expect(after.wrong).toEqual([wrong]);
    expect(after.isSolved).toBe(false);
  });

  it("still takes the right word after both wrong ones", () => {
    let state = newGame();
    state = pick(state, wrongWordOf(state, 0));
    state = pick(state, wrongWordOf(state, 1));

    state = pick(state, roundOf(state).wordId);

    expect(state.isSolved).toBe(true);
  });

  it("solves the round on the right word, then moves on with next", () => {
    const game = pick(newGame(), wrongWordOf(newGame()));

    const solved = pick(game, roundOf(game).wordId);
    expect(solved.isSolved).toBe(true);
    expect(solved.current).toBe(0);

    const next = matchReducer(solved, { type: "next" });
    expect(next.current).toBe(1);
    expect(next.wrong).toEqual([]);
    expect(next.isSolved).toBe(false);
  });

  it("ignores a word already set aside, one not on offer, and taps once solved", () => {
    const game = newGame();
    const wrong = pick(game, wrongWordOf(game));
    expect(pick(wrong, wrongWordOf(game))).toBe(wrong);
    expect(pick(game, "word-unknown")).toBe(game);

    const solved = pick(game, roundOf(game).wordId);
    expect(pick(solved, wrongWordOf(game))).toBe(solved);
  });

  it("does not move on from a round that is not solved", () => {
    const game = newGame();

    expect(matchReducer(game, { type: "next" })).toBe(game);
  });
});

describe("isComplete", () => {
  it("is true once every round is solved, and not before", () => {
    let state = newGame();
    for (let round = 0; round < state.rounds.length; round += 1) {
      expect(isComplete(state)).toBe(false);
      state = solve(state);
    }

    expect(isComplete(state)).toBe(true);
    expect(currentRound(state)).toBeNull();
  });

  it("ignores picks once the game is complete", () => {
    let state = newGame();
    while (!isComplete(state)) {
      state = solve(state);
    }

    expect(pick(state, "word-1")).toBe(state);
  });
});

describe("canDealMatchGame", () => {
  it("deals with three words and one picture", () => {
    expect(canDealMatchGame([word(1), word(2, null), word(3, null)])).toBe(
      true,
    );
  });

  it("does not deal as createMatchGame does not", () => {
    expect(canDealMatchGame([word(1), word(2)])).toBe(false);
    expect(
      canDealMatchGame([word(1, null), word(2, null), word(3, null)]),
    ).toBe(false);
  });
});

describe("createMatchGame with a round cap (#233)", () => {
  const TWENTY_WORDS = Array.from({ length: 20 }, (_, i) => word(i + 1));

  it("plays only `rounds` words, each a different one", () => {
    const game = createMatchGame(TWENTY_WORDS, seeded(3), { rounds: 10 });

    expect(game?.rounds).toHaveLength(10);
    expect(new Set(game?.rounds.map((round) => round.wordId)).size).toBe(10);
  });

  it("picks the words at random, not the first ones", () => {
    const first = createMatchGame(TWENTY_WORDS, seeded(3), { rounds: 10 });
    const second = createMatchGame(TWENTY_WORDS, seeded(7), { rounds: 10 });

    expect(first?.rounds.map((round) => round.wordId)).not.toEqual(
      second?.rounds.map((round) => round.wordId),
    );
    expect(first?.rounds.map((round) => round.wordId).sort()).not.toEqual(
      TWENTY_WORDS.slice(0, 10)
        .map((item) => item.id)
        .sort(),
    );
  });

  it("can offer a word with no round of its own as a wrong option", () => {
    const game = createMatchGame(TWENTY_WORDS, seeded(3), { rounds: 2 });
    const played = new Set(game?.rounds.map((round) => round.wordId));
    const offered = game?.rounds.flatMap((round) =>
      round.options.map((option) => option.wordId),
    );

    expect(offered?.some((id) => !played.has(id))).toBe(true);
  });

  it("plays every word when the cap is above their number", () => {
    const game = createMatchGame(SIX_WORDS, seeded(3), { rounds: 10 });

    expect(game?.rounds).toHaveLength(SIX_WORDS.length);
  });

  it.each([0, -1, 2.5, Number.NaN])("refuses a cap of %s", (rounds) => {
    expect(() => createMatchGame(TWENTY_WORDS, seeded(3), { rounds })).toThrow(
      RangeError,
    );
  });

  it("plays every word without a cap, as a chapter does", () => {
    expect(createMatchGame(TWENTY_WORDS, seeded(3))?.rounds).toHaveLength(20);
  });
});
