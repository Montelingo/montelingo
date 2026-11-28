// The match game's rules (#137, ADR 0006): one picture and three written
// words, and the child taps the word that goes with the picture. Pure
// functions, no React: the screen drives `matchReducer` with `useReducer`.
// No timer, no score, no fail state: a wrong word is set aside and the child
// picks again.

import { type Random, shuffle } from "@/lib/random";

/** How many words a round offers: the right one and two others. */
export const OPTIONS = 3;

/** What the game needs of a word. A chapter's words fit as they are. */
export type MatchWord = {
  id: string;
  text: string;
  imageUrl: string | null;
  /** The 512 px picture (#206); `null` when the API sent none. */
  imageUrl512: string | null;
};

/** A word the child can tap. */
export type MatchOption = {
  wordId: string;
  text: string;
};

export type MatchRound = {
  /** The word whose picture the round shows. */
  wordId: string;
  imageUrl: string;
  imageUrl512: string | null;
  /** `OPTIONS` words, the right one among them, in random order. */
  options: readonly MatchOption[];
};

/** How a game is dealt. A chapter needs none of it. */
export type MatchDeal = {
  /**
   * The most rounds to play, from words chosen at random. The words left out
   * can still be offered as wrong ones.
   */
  rounds?: number;
};

export type MatchState = {
  /** One round per word with a picture, in random order, up to the cap. */
  rounds: readonly MatchRound[];
  /** The round on screen, from 0; `rounds.length` once every round is done. */
  current: number;
  /** The words tapped wrongly this round: set aside, no longer tappable. */
  wrong: readonly string[];
  /**
   * The right word was tapped: it shows a moment before `next` moves on, so
   * the child sees it.
   */
  isSolved: boolean;
};

export type MatchAction =
  | { type: "pick"; wordId: string }
  /** Move on from a solved round. The screen sends it shortly after a pick. */
  | { type: "next" };

/**
 * Whether `words` deal a game: at least one has a picture, and the chapter
 * has `OPTIONS` words that read differently, so every round has its three.
 * The route asks first, so a chapter that cannot be played says so.
 */
export function canDealMatchGame(words: readonly MatchWord[]): boolean {
  return createMatchGame(words, () => 0) !== null;
}

/**
 * Deal a new game: a round for every word with a picture of its own, in
 * random order, each with its word and two others from `words`, in random
 * order. With `rounds`, it stops once that many are dealt. `null` when not
 * even one round can be dealt.
 */
export function createMatchGame(
  words: readonly MatchWord[],
  random: Random,
  { rounds: cap = Infinity }: MatchDeal = {},
): MatchState | null {
  const distinct = distinctWords(words);
  const pictures = wordsWithOwnPicture(distinct);

  const rounds: MatchRound[] = [];
  for (const word of shuffle(pictures, random)) {
    // Stopping here, not slicing the shuffle first, keeps the cap at dealt
    // rounds: a word with too few others to offer does not use up a round.
    if (rounds.length >= cap) {
      break;
    }
    // Never a word that reads the same or shows the same picture: either
    // would be a second right answer.
    const others = distinct.filter(
      (other) =>
        !sameText(other.text, word.text) && other.imageUrl !== word.imageUrl,
    );
    if (others.length < OPTIONS - 1) {
      continue;
    }
    const options = [word, ...shuffle(others, random).slice(0, OPTIONS - 1)];
    rounds.push({
      wordId: word.id,
      imageUrl: word.imageUrl,
      imageUrl512: word.imageUrl512,
      options: shuffle(options, random).map(({ id, text }) => ({
        wordId: id,
        text,
      })),
    });
  }

  if (rounds.length === 0) {
    return null;
  }
  return { rounds, current: 0, wrong: [], isSolved: false };
}

/**
 * The next state after an action. An action that changes nothing returns the
 * same state, so React skips the render.
 */
export function matchReducer(
  state: MatchState,
  action: MatchAction,
): MatchState {
  switch (action.type) {
    case "pick":
      return pick(state, action.wordId);
    case "next":
      return state.isSolved
        ? { ...state, current: state.current + 1, wrong: [], isSolved: false }
        : state;
  }
}

/** The round on screen, or `null` once every round is done. */
export function currentRound(state: MatchState): MatchRound | null {
  return state.rounds[state.current] ?? null;
}

/** Whether every round is done. A game with no rounds is never complete. */
export function isComplete(state: MatchState): boolean {
  return state.rounds.length > 0 && state.current >= state.rounds.length;
}

function pick(state: MatchState, wordId: string): MatchState {
  const round = currentRound(state);
  if (
    round === null ||
    state.isSolved ||
    state.wrong.includes(wordId) ||
    !round.options.some((option) => option.wordId === wordId)
  ) {
    return state;
  }
  if (wordId === round.wordId) {
    return { ...state, isSolved: true };
  }
  return { ...state, wrong: [...state.wrong, wordId] };
}

function sameText(a: string, b: string): boolean {
  return textKey(a) === textKey(b);
}

/** A word's text as rounds compare it: two texts with one key read the same. */
export function textKey(text: string): string {
  return text.trim().toLocaleLowerCase();
}

/** Each word once, by id. */
function distinctWords(words: readonly MatchWord[]): MatchWord[] {
  const seen = new Set<string>();
  return words.filter((word) => {
    if (seen.has(word.id)) {
      return false;
    }
    seen.add(word.id);
    return true;
  });
}

/**
 * The words a round can show: each has a picture, and a picture two words
 * share is shown for neither, since both words would be right. Sastavi riječi
 * deals by the same rule.
 */
export function wordsWithOwnPicture<W extends MatchWord>(
  words: readonly W[],
): (W & { imageUrl: string })[] {
  const uses = new Map<string, number>();
  for (const { imageUrl } of words) {
    if (imageUrl) {
      uses.set(imageUrl, (uses.get(imageUrl) ?? 0) + 1);
    }
  }
  return words.filter(
    (word): word is W & { imageUrl: string } =>
      Boolean(word.imageUrl) && uses.get(word.imageUrl as string) === 1,
  );
}
