import { describe, expect, it } from "vitest";

import {
  cardIndex,
  cardPositionLabel,
  INITIAL_LESSON,
  isFirstCard,
  isLastCard,
  type LessonAction,
  lessonReducer,
  type LessonState,
} from "./lesson";

function run(
  count: number,
  state: LessonState,
  ...actions: LessonAction[]
): LessonState {
  return actions.reduce(
    (current, action) => lessonReducer(current, action, count),
    state,
  );
}

const NEXT = { type: "next" } as const;
const BACK = { type: "back" } as const;
const WORDS = { type: "mode", mode: "words" } as const;
const PICTURES = { type: "mode", mode: "pictures" } as const;

describe("lessonReducer", () => {
  it("starts on the first picture", () => {
    expect(INITIAL_LESSON).toEqual({ mode: "pictures", index: 0 });
  });

  it("moves forward and back one card at a time", () => {
    expect(run(10, INITIAL_LESSON, NEXT, NEXT).index).toBe(2);
    expect(run(10, INITIAL_LESSON, NEXT, NEXT, BACK).index).toBe(1);
  });

  it("stays on the first card on Back", () => {
    expect(lessonReducer(INITIAL_LESSON, BACK, 10)).toBe(INITIAL_LESSON);
  });

  it("stays on the last card on Next", () => {
    const last = run(3, INITIAL_LESSON, NEXT, NEXT);

    expect(last.index).toBe(2);
    expect(lessonReducer(last, NEXT, 3)).toBe(last);
  });

  it("stays put with no cards", () => {
    expect(run(0, INITIAL_LESSON, NEXT, BACK)).toBe(INITIAL_LESSON);
  });

  it("starts again from the first card when the mode changes", () => {
    const third = run(10, INITIAL_LESSON, NEXT, NEXT);

    expect(lessonReducer(third, WORDS, 10)).toEqual({
      mode: "words",
      index: 0,
    });
  });

  it("starts from the second card when the first is the word just shown", () => {
    expect(lessonReducer(INITIAL_LESSON, WORDS, 10)).toEqual({
      mode: "words",
      index: 1,
    });
    expect(run(10, INITIAL_LESSON, NEXT, WORDS, PICTURES)).toEqual({
      mode: "pictures",
      index: 1,
    });
  });

  it("keeps the card when the mode on screen is chosen again", () => {
    const third = run(10, INITIAL_LESSON, NEXT, NEXT);

    expect(lessonReducer(third, PICTURES, 10)).toBe(third);
  });

  it("moves from the last card there is when the words have become fewer", () => {
    const tenth: LessonState = { mode: "pictures", index: 9 };

    expect(lessonReducer(tenth, BACK, 8).index).toBe(6);
    expect(lessonReducer(tenth, NEXT, 8)).toBe(tenth);
  });
});

describe("cardIndex, isFirstCard and isLastCard", () => {
  it("know the lesson's ends", () => {
    const end = lessonReducer(INITIAL_LESSON, NEXT, 2);

    expect(isFirstCard(INITIAL_LESSON, 2)).toBe(true);
    expect(isLastCard(INITIAL_LESSON, 2)).toBe(false);
    expect(isFirstCard(end, 2)).toBe(false);
    expect(isLastCard(end, 2)).toBe(true);
  });

  it("keep the card within the words there are", () => {
    expect(cardIndex({ mode: "words", index: 9 }, 8)).toBe(7);
    expect(cardIndex(INITIAL_LESSON, 0)).toBe(0);
  });
});

describe("cardPositionLabel", () => {
  it("counts from one, in Montenegrin", () => {
    expect(cardPositionLabel(run(10, INITIAL_LESSON, NEXT, NEXT), 10)).toBe(
      "3 od 10",
    );
  });
});
