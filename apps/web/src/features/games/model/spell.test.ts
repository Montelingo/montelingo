import { describe, expect, it } from "vitest";

import {
  canDealSpellGame,
  createSpellGame,
  currentRound,
  isComplete,
  SPELL_MAX_LETTERS,
  SPELL_ROUNDS,
  type SpellRound,
  type SpellState,
  type SpellWord,
  spellLetters,
  spellReducer,
} from "./spell";
import { seeded } from "./test-random";

function word(
  text: string,
  imageUrl: string | null = `/w/${text}.webp`,
): SpellWord {
  return { id: `id-${text}`, text, imageUrl };
}

const BUDVA = ["more", "riba", "rak", "sunce", "galeb", "kamen", "sidro"].map(
  (text) => word(text),
);

function newGame(words: readonly SpellWord[] = BUDVA, seed = 1): SpellState {
  const game = createSpellGame(words, seeded(seed));
  if (game === null) {
    throw new Error("expected a game");
  }
  return game;
}

function roundOf(state: SpellState): SpellRound {
  const round = currentRound(state);
  if (round === null) {
    throw new Error("expected a round");
  }
  return round;
}

function tap(state: SpellState, tileId: string): SpellState {
  return spellReducer(state, { type: "tap", tileId });
}

/** The id of an unplaced tile with `letter`. */
function tileFor(state: SpellState, letter: string): string {
  const tile = roundOf(state).tiles.find(
    (item) => item.letter === letter && !state.placed.includes(item.id),
  );
  if (tile === undefined) {
    throw new Error(`expected a tile for ${letter}`);
  }
  return tile.id;
}

/** Every letter in order: the round is solved. */
function spell(state: SpellState): SpellState {
  return roundOf(state).letters.reduce(
    (next, letter) => tap(next, tileFor(next, letter)),
    state,
  );
}

/** Solve the round, then on to the next. */
function solve(state: SpellState): SpellState {
  return spellReducer(spell(state), { type: "next" });
}

describe("spellLetters", () => {
  it.each([
    ["riba", ["r", "i", "b", "a"]],
    ["konj", ["k", "o", "nj"]],
    ["školjka", ["š", "k", "o", "lj", "k", "a"]],
    ["pidžama", ["p", "i", "dž", "a", "m", "a"]],
    ["Džep", ["Dž", "e", "p"]],
    ["LJUBAV", ["LJ", "U", "B", "A", "V"]],
    ["njiva", ["nj", "i", "v", "a"]],
    ["  kamen ", ["k", "a", "m", "e", "n"]],
  ])("splits %j into Montenegrin letters", (text, letters) => {
    expect(spellLetters(text)).toEqual(letters);
  });

  it("reads a ž written as z and a combining caron as one letter", () => {
    expect(spellLetters("plaža")).toEqual(spellLetters("plaža"));
    expect(spellLetters("plaža")).toEqual(["p", "l", "a", "ž", "a"]);
  });

  it("keeps a j that follows another letter on its own", () => {
    expect(spellLetters("zmaj")).toEqual(["z", "m", "a", "j"]);
  });
});

describe("createSpellGame", () => {
  it(`deals ${SPELL_ROUNDS} words, shortest first`, () => {
    const game = newGame();

    expect(game.rounds).toHaveLength(SPELL_ROUNDS);
    const lengths = game.rounds.map((round) => round.letters.length);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
    expect(new Set(game.rounds.map((round) => round.wordId)).size).toBe(
      SPELL_ROUNDS,
    );
    expect(game).toMatchObject({
      current: 0,
      placed: [],
      bounced: null,
      isSolved: false,
    });
  });

  it("chooses the words at random", () => {
    const deals = [1, 2, 3, 4, 5].map((seed) =>
      newGame(BUDVA, seed)
        .rounds.map((round) => round.wordId)
        .sort()
        .join(),
    );

    expect(new Set(deals).size).toBeGreaterThan(1);
  });

  it("plays fewer rounds when fewer words can be played", () => {
    expect(newGame(BUDVA.slice(0, 2)).rounds).toHaveLength(2);
  });

  it("gives each round its word's picture, letters and tiles", () => {
    const round = roundOf(newGame([word("konj")]));

    expect(round).toMatchObject({
      wordId: "id-konj",
      imageUrl: "/w/konj.webp",
      letters: ["k", "o", "nj"],
    });
    expect(round.tiles.map((tile) => tile.letter).sort()).toEqual([
      "k",
      "nj",
      "o",
    ]);
    expect(new Set(round.tiles.map((tile) => tile.id)).size).toBe(3);
  });

  it("never deals the tiles already in order", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const round = roundOf(newGame([word("rak")], seed));
      expect(round.tiles.map((tile) => tile.letter)).not.toEqual([
        "r",
        "a",
        "k",
      ]);
    }
  });

  it("leaves out words without a picture of their own", () => {
    const shared = "/w/shared.webp";
    const game = newGame([
      word("riba", null),
      word("rak", shared),
      word("more", shared),
      word("sunce"),
    ]);

    expect(game.rounds.map((round) => round.wordId)).toEqual(["id-sunce"]);
  });

  it("leaves out words with a space or a hyphen", () => {
    const game = newGame([
      word("morski konjić"),
      word("kupaći-kostim"),
      word("galeb"),
    ]);

    expect(game.rounds.map((round) => round.wordId)).toEqual(["id-galeb"]);
  });

  it(`leaves out words longer than ${SPELL_MAX_LETTERS} letters`, () => {
    // "svjetionik" has 10 letters; "narandžasta" has 10 too, as dž is one.
    const game = newGame([
      word("svjetionik"),
      word("narandžasta"),
      word("hobotnica"),
      word("kornjača"),
    ]);

    // "kornjača" is 7 letters (nj is one), "hobotnica" is 9.
    expect(game.rounds.map((round) => round.wordId)).toEqual(["id-kornjača"]);
  });

  it("deals each word once", () => {
    const riba = word("riba");

    expect(newGame([riba, riba]).rounds).toHaveLength(1);
  });

  it("deals nothing when no word can be played", () => {
    expect(createSpellGame([], seeded(1))).toBeNull();
    expect(createSpellGame([word("riba", null)], seeded(1))).toBeNull();
    expect(canDealSpellGame([word("morska zvijezda")])).toBe(false);
    expect(canDealSpellGame([word("riba")])).toBe(true);
  });
});

describe("spellReducer", () => {
  it("fills the next slot with a right tile", () => {
    const game = newGame([word("riba")]);
    const r = tileFor(game, "r");

    const next = tap(game, r);

    expect(next.placed).toEqual([r]);
    expect(next.isSolved).toBe(false);
  });

  it("bounces a wrong tile back and changes nothing that counts", () => {
    const game = newGame([word("riba")]);
    const a = tileFor(game, "a");

    const next = tap(game, a);

    expect(next).toMatchObject({ placed: [], bounced: a, bounces: 1 });
    // It stays tappable, and a second bounce counts again.
    expect(tap(next, a)).toMatchObject({ bounced: a, bounces: 2 });
    // A right tile clears the bounce.
    expect(tap(next, tileFor(next, "r")).bounced).toBeNull();
  });

  it("fills a repeated letter's slot with either of its tiles", () => {
    // sladoled: s, l, a, d, o, l, e, d.
    const game = newGame([word("sladoled")]);
    const ls = roundOf(game)
      .tiles.filter((tile) => tile.letter === "l")
      .map((tile) => tile.id);
    const second = ls[1] as string;

    const next = tap(tap(game, tileFor(game, "s")), second);

    expect(next.placed).toEqual([tileFor(game, "s"), second]);
  });

  it("ignores a tile already placed, and one from another round", () => {
    const game = newGame([word("riba")]);
    const placed = tap(game, tileFor(game, "r"));

    expect(tap(placed, placed.placed[0] as string)).toBe(placed);
    expect(tap(placed, "id-other:0")).toBe(placed);
  });

  it("solves the round when every slot is filled, then takes no tap", () => {
    const game = newGame([word("konj")]);

    const solved = spell(game);

    expect(solved.isSolved).toBe(true);
    expect(tap(solved, roundOf(solved).tiles[0]?.id as string)).toBe(solved);
  });

  it("moves on only from a solved round", () => {
    const game = newGame();

    expect(spellReducer(game, { type: "next" })).toBe(game);
    const next = solve(game);
    expect(next).toMatchObject({
      current: 1,
      placed: [],
      bounced: null,
      isSolved: false,
    });
  });

  it("is complete after every round, and never before", () => {
    let state = newGame();
    for (let i = 0; i < SPELL_ROUNDS; i += 1) {
      expect(isComplete(state)).toBe(false);
      state = solve(state);
    }

    expect(isComplete(state)).toBe(true);
    expect(currentRound(state)).toBeNull();
    expect(tap(state, "id-more:0")).toBe(state);
  });
});
