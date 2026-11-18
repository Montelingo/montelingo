// A chapter's lesson, Doman style (#129, #130, ADR 0006). Pure functions, no React:
// `LessonCards` drives `lessonReducer` with `useReducer`. The number of cards
// is the chapter's words, passed in rather than stored, so it is never stale.

/** What the lesson needs of a word. A chapter's words fit as they are. */
export type LessonWord = {
  id: string;
  /** Recording number: keys the placeholder art when there is no picture. */
  number: number;
  text: string;
  imageUrl: string | null;
};

/** Pictures alone (the default), or words alone: never both on one card. */
export const LESSON_MODES = ["pictures", "words"] as const;

export type LessonMode = (typeof LESSON_MODES)[number];

export type LessonState = {
  mode: LessonMode;
  /** The card on screen, from 0. Read it through `cardIndex`. */
  index: number;
  /** Past the last card: the "Bravo!" screen is showing. */
  finished: boolean;
  /** The lesson has reached "Bravo!" at least once (it stays true on "Watch again"). */
  watchedToEnd: boolean;
};

export type LessonAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "mode"; mode: LessonMode }
  /** "Watch again": the first card, in the mode the lesson was watched in. */
  | { type: "restart" };

export const INITIAL_LESSON: LessonState = {
  mode: "pictures",
  index: 0,
  finished: false,
  watchedToEnd: false,
};

export function lessonReducer(
  state: LessonState,
  action: LessonAction,
  count: number,
): LessonState {
  if (count === 0 || (state.finished && action.type !== "restart")) {
    // "Bravo!" leads only back to the first card.
    return state;
  }
  const index = cardIndex(state, count);
  switch (action.type) {
    case "next":
      // Next on the last card ends the lesson.
      return index === count - 1
        ? { ...state, index, finished: true, watchedToEnd: true }
        : { ...state, index: index + 1 };
    case "back":
      return index === 0 ? state : { ...state, index: index - 1 };
    case "mode":
      // Pressing the mode already on screen keeps the child's place.
      return action.mode === state.mode
        ? state
        : {
            ...state,
            mode: action.mode,
            index: firstCardAfterSwitch(index, count),
          };
    case "restart":
      return state.finished ? { ...state, index: 0, finished: false } : state;
  }
}

/**
 * The card on screen, within the lesson's `count` cards even when the words
 * have become fewer since the card was chosen.
 */
export function cardIndex(state: LessonState, count: number): number {
  return Math.max(0, Math.min(state.index, count - 1));
}

export function isFirstCard(state: LessonState, count: number): boolean {
  return cardIndex(state, count) === 0;
}

/** The card's place in the lesson, as screen readers hear it: "3 od 10". */
export function cardPositionLabel(state: LessonState, count: number): string {
  return `${cardIndex(state, count) + 1} od ${count}`;
}

// A switch starts again from the first card, unless the first card is the
// word just shown: then the second, so a picture is never followed by its
// own word, nor a word by its picture (ADR 0006).
function firstCardAfterSwitch(index: number, count: number): number {
  return index === 0 && count > 1 ? 1 : 0;
}
