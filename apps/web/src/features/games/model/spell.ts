// Sastavi riječi: the rules (#296, ADR 0006), a word's picture, one empty
// slot per letter, and that word's letters as shuffled tiles. The child taps
// them in order. Pure functions, no React: the screen drives `spellReducer` with
// `useReducer`. No timer, no score, no fail state: a wrong tile bounces back
// and stays tappable. Played only from the Riječi tab (#294).

import { type Random, shuffle } from "@/lib/random";

import { type MatchWord, wordsWithOwnPicture } from "./match";

/** How many words one game plays: its five steps, and one heart. */
export const SPELL_ROUNDS = 5;

/** The longest word a game deals, in letters. Tune after testing with children. */
export const SPELL_MAX_LETTERS = 8;

/** What the game needs of a word: what match needs. */
export type SpellWord = MatchWord;

/** A letter the child can tap. Its id tells two tiles of one letter apart. */
export type SpellTile = {
  id: string;
  letter: string;
};

export type SpellRound = {
  wordId: string;
  imageUrl: string;
  /** The word's letters, in order: one slot each. */
  letters: readonly string[];
  /** The same letters, shuffled, never already in order. */
  tiles: readonly SpellTile[];
};

export type SpellState = {
  /** Up to `SPELL_ROUNDS` rounds, shortest word first. */
  rounds: readonly SpellRound[];
  /** The round on screen, from 0; `rounds.length` once every round is done. */
  current: number;
  /** The tiles placed this round, in order: the first `placed.length` slots are filled. */
  placed: readonly string[];
  /** The tile that last bounced back, for the screen to shake; `null` after a right tap. */
  bounced: string | null;
  /** Counts the bounces, so the screen can shake one tile twice in a row. */
  bounces: number;
  /**
   * Every slot is filled: the word shows a moment before `next` moves on,
   * so the child sees it.
   */
  isSolved: boolean;
};

export type SpellAction =
  | { type: "tap"; tileId: string }
  /** Move on from a solved round. The screen sends it shortly after the last tile. */
  | { type: "next" };

// Montenegrin letters written with two characters (Latin script). Lower case:
// a pair is compared in lower case, so "Lj", "LJ" and "lj" are each one letter.
const DIGRAPHS = new Set(["lj", "nj", "dž"]);

const graphemes = new Intl.Segmenter("sr-Latn-ME", { granularity: "grapheme" });

/**
 * A word's Montenegrin letters, in order: "konj" is k, o, nj, and "Džep" is
 * Dž, e, p. Each keeps the word's own case. The text is NFC-normalised first,
 * so a "ž" stored as "z" and a combining caron is one letter too.
 *
 * Every lj, nj and dž counts as one letter. In a few words it is two, as in
 * "nadživjeti" (nad-živjeti); none is in the content today.
 */
export function spellLetters(text: string): string[] {
  const characters = Array.from(
    graphemes.segment(text.trim().normalize("NFC")),
    ({ segment }) => segment,
  );
  const letters: string[] = [];
  for (let i = 0; i < characters.length; i += 1) {
    const pair = `${characters[i]}${characters[i + 1] ?? ""}`;
    if (DIGRAPHS.has(pair.toLocaleLowerCase("sr-Latn-ME"))) {
      letters.push(pair);
      i += 1;
    } else {
      letters.push(characters[i] as string);
    }
  }
  return letters;
}

/** Whether `words` deal a game: at least one can be a round. The route asks first. */
export function canDealSpellGame(words: readonly SpellWord[]): boolean {
  return createSpellGame(words, () => 0) !== null;
}

/**
 * Deal a new game: up to `SPELL_ROUNDS` words chosen at random from those
 * with a picture of their own, no space or hyphen, and at most
 * `SPELL_MAX_LETTERS` letters, then played shortest first. `null` when no
 * word can be a round.
 */
export function createSpellGame(
  words: readonly SpellWord[],
  random: Random,
): SpellState | null {
  const playable = wordsWithOwnPicture(distinctWords(words))
    .map((word) => ({ word, letters: spellLetters(word.text) }))
    .filter(
      ({ word, letters }) =>
        !/[\s-]/.test(word.text.trim()) &&
        letters.length >= 2 &&
        letters.length <= SPELL_MAX_LETTERS,
    );

  const rounds = shuffle(playable, random)
    .slice(0, SPELL_ROUNDS)
    // A stable sort: words of one length keep their random order.
    .sort((a, b) => a.letters.length - b.letters.length)
    .map(
      ({ word, letters }): SpellRound => ({
        wordId: word.id,
        imageUrl: word.imageUrl,
        letters,
        tiles: dealTiles(word.id, letters, random),
      }),
    );

  if (rounds.length === 0) {
    return null;
  }
  return {
    rounds,
    current: 0,
    placed: [],
    bounced: null,
    bounces: 0,
    isSolved: false,
  };
}

/**
 * The next state after an action. An action that changes nothing returns the
 * same state, so React skips the render.
 */
export function spellReducer(
  state: SpellState,
  action: SpellAction,
): SpellState {
  switch (action.type) {
    case "tap":
      return tap(state, action.tileId);
    case "next":
      return state.isSolved
        ? {
            ...state,
            current: state.current + 1,
            placed: [],
            bounced: null,
            isSolved: false,
          }
        : state;
  }
}

/** The round on screen, or `null` once every round is done. */
export function currentRound(state: SpellState): SpellRound | null {
  return state.rounds[state.current] ?? null;
}

/** Whether every round is done. A game with no rounds is never complete. */
export function isComplete(state: SpellState): boolean {
  return state.rounds.length > 0 && state.current >= state.rounds.length;
}

function tap(state: SpellState, tileId: string): SpellState {
  const round = currentRound(state);
  const tile = round?.tiles.find((item) => item.id === tileId);
  if (
    round === null ||
    tile === undefined ||
    state.isSolved ||
    state.placed.includes(tileId)
  ) {
    return state;
  }
  // Any tile with the next slot's letter fits: in "sladoled", either "l".
  if (tile.letter === round.letters[state.placed.length]) {
    const placed = [...state.placed, tileId];
    return {
      ...state,
      placed,
      bounced: null,
      isSolved: placed.length === round.letters.length,
    };
  }
  return { ...state, bounced: tileId, bounces: state.bounces + 1 };
}

/**
 * The word's letters as tiles, shuffled. A shuffle that comes out in the
 * word's own order is turned by one tile, so there is always something to
 * do; only a word of one repeated letter stays as it is.
 */
function dealTiles(
  wordId: string,
  letters: readonly string[],
  random: Random,
): SpellTile[] {
  const tiles = letters.map((letter, i) => ({
    id: `${wordId}:${i}`,
    letter,
  }));
  const shuffled = shuffle(tiles, random);
  const isInOrder = shuffled.every((tile, i) => tile.letter === letters[i]);
  return isInOrder ? [...shuffled.slice(1), ...shuffled.slice(0, 1)] : shuffled;
}

/** Each word once, by id. */
function distinctWords(words: readonly SpellWord[]): SpellWord[] {
  const seen = new Set<string>();
  return words.filter((word) => {
    if (seen.has(word.id)) {
      return false;
    }
    seen.add(word.id);
    return true;
  });
}
