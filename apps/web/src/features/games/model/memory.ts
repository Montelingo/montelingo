// The memory game's rules (#131, ADR 0006): cards face down, turn two over,
// and a pair is two of the same picture. Pure functions, no React: the board
// (#132) drives `memoryReducer` with `useReducer` and renders `cardFace`.
// No timer, no score, no fail state: a miss simply turns back.

import { type Random, shuffle } from "@/lib/random";

/** How many pairs a game deals, at most. Tune after testing with children. */
export const PAIRS = 6;

/** The fewest pairs that still make a game. */
export const MIN_PAIRS = 3;

/** What the game needs of a word. A chapter's words fit as they are. */
export type MemoryWord = {
  id: string;
  text: string;
  imageUrl: string | null;
};

export type MemoryCard = {
  /** Unique per card: the two cards of a pair share `wordId`, not `id`. */
  id: string;
  wordId: string;
  text: string;
  imageUrl: string;
};

export type MemoryState = {
  /** The dealt cards, in board order. */
  cards: readonly MemoryCard[];
  /** Cards turned over and not yet found: none, one, or a miss of two. */
  faceUp: readonly string[];
  /** The word ids of the pairs found so far. */
  matched: readonly string[];
};

export type MemoryAction =
  | { type: "flip"; cardId: string }
  /** Turn a miss back over. The board sends it about a second after a miss. */
  | { type: "hide-miss" };

export type CardFace = "down" | "up" | "matched";

type PictureWord = MemoryWord & { imageUrl: string };

/**
 * Whether `words` deal a game: at least `MIN_PAIRS` of them have a picture of
 * their own. The route asks first, so a chapter without enough pictures yet
 * says so instead of showing an empty board.
 */
export function canDealMemoryGame(words: readonly MemoryWord[]): boolean {
  return distinctPictureWords(words).length >= MIN_PAIRS;
}

/**
 * Deal a new game: up to `PAIRS` words that have a picture, chosen at random,
 * two cards each, shuffled. `null` when fewer than `MIN_PAIRS` words have a
 * picture, so there is no game to play.
 */
export function createMemoryGame(
  words: readonly MemoryWord[],
  random: Random,
): MemoryState | null {
  const withPictures = distinctPictureWords(words);
  if (withPictures.length < MIN_PAIRS) {
    return null;
  }

  const chosen = shuffle(withPictures, random).slice(0, PAIRS);
  const cards = chosen.flatMap((word) =>
    (["a", "b"] as const).map((side) => ({
      id: `${word.id}-${side}`,
      wordId: word.id,
      text: word.text,
      imageUrl: word.imageUrl,
    })),
  );

  return { cards: shuffle(cards, random), faceUp: [], matched: [] };
}

/**
 * The next state after an action. An action that changes nothing returns the
 * same state, so React skips the render.
 */
export function memoryReducer(
  state: MemoryState,
  action: MemoryAction,
): MemoryState {
  switch (action.type) {
    case "flip":
      return flip(state, action.cardId);
    case "hide-miss":
      return isMissShowing(state) ? { ...state, faceUp: [] } : state;
  }
}

/** Whether two different pictures are showing, waiting for `hide-miss`. */
export function isMissShowing(state: MemoryState): boolean {
  return state.faceUp.length === 2;
}

/** Whether every pair is found. A game with no cards is never complete. */
export function isComplete(state: MemoryState): boolean {
  return (
    state.cards.length > 0 && state.matched.length * 2 === state.cards.length
  );
}

/** How a card shows: face down, turned over, or part of a found pair. */
export function cardFace(state: MemoryState, cardId: string): CardFace {
  const card = state.cards.find((candidate) => candidate.id === cardId);
  if (card !== undefined && state.matched.includes(card.wordId)) {
    return "matched";
  }
  return state.faceUp.includes(cardId) ? "up" : "down";
}

function flip(state: MemoryState, cardId: string): MemoryState {
  if (isMissShowing(state) || cardFace(state, cardId) !== "down") {
    return state;
  }
  const card = state.cards.find((candidate) => candidate.id === cardId);
  if (card === undefined) {
    return state;
  }

  const [turned] = state.faceUp;
  if (turned === undefined) {
    return { ...state, faceUp: [cardId] };
  }

  const first = state.cards.find((candidate) => candidate.id === turned);
  if (first?.wordId === card.wordId) {
    return { ...state, faceUp: [], matched: [...state.matched, card.wordId] };
  }
  return { ...state, faceUp: [turned, cardId] };
}

/**
 * The words that can be dealt: each has a picture, and each word and each
 * picture appears once. A pair is "two of the same picture", so two words
 * sharing a picture would make a matching-looking pair count as a miss.
 */
function distinctPictureWords(words: readonly MemoryWord[]): PictureWord[] {
  const seenWords = new Set<string>();
  const seenPictures = new Set<string>();
  const result: PictureWord[] = [];
  for (const word of words) {
    const { imageUrl } = word;
    if (!imageUrl || seenWords.has(word.id) || seenPictures.has(imageUrl)) {
      continue;
    }
    seenWords.add(word.id);
    seenPictures.add(imageUrl);
    result.push({ ...word, imageUrl });
  }
  return result;
}
