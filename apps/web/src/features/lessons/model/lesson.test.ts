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
const RESTART = { type: "restart" } as const;

describe("lessonReducer", () => {
  it("starts on the first picture", () => {
    expect(INITIAL_LESSON).toEqual({
      mode: "pictures",
      index: 0,
      finished: false,
    });
  });

  it("moves forward and back one card at a time", () => {
    expect(run(10, INITIAL_LESSON, NEXT, NEXT).index).toBe(2);
    expect(run(10, INITIAL_LESSON, NEXT, NEXT, BACK).index).toBe(1);
  });

  it("stays on the first card on Back", () => {
    expect(lessonReducer(INITIAL_LESSON, BACK, 10)).toBe(INITIAL_LESSON);
  });

  it("finishes on Next from the last card", () => {
    const last = run(3, INITIAL_LESSON, NEXT, NEXT);

    expect(last.finished).toBe(false);
    expect(lessonReducer(last, NEXT, 3)).toEqual({
      mode: "pictures",
      index: 2,
      finished: true,
    });
  });

  it("goes nowhere from the end but back to the first card, in the same mode", () => {
    const end = run(3, INITIAL_LESSON, WORDS, NEXT, NEXT);

    expect(end.finished).toBe(true);
    expect(run(3, end, NEXT, BACK, PICTURES)).toBe(end);
    expect(lessonReducer(end, RESTART, 3)).toEqual({
      mode: "words",
      index: 0,
      finished: false,
    });
  });

  it("ignores Watch again during the lesson", () => {
    const second = run(3, INITIAL_LESSON, NEXT);

    expect(lessonReducer(second, RESTART, 3)).toBe(second);
  });

  it("stays put with no cards", () => {
    expect(run(0, INITIAL_LESSON, NEXT, BACK, RESTART)).toBe(INITIAL_LESSON);
  });

  it("starts again from the first card when the mode changes", () => {
    const third = run(10, INITIAL_LESSON, NEXT, NEXT);

    expect(lessonReducer(third, WORDS, 10)).toEqual({
      ...INITIAL_LESSON,
      mode: "words",
      index: 0,
    });
  });

  it("starts from the second card when the first is the word just shown", () => {
    expect(lessonReducer(INITIAL_LESSON, WORDS, 10)).toEqual({
      ...INITIAL_LESSON,
      mode: "words",
      index: 1,
    });
    expect(run(10, INITIAL_LESSON, NEXT, WORDS, PICTURES)).toEqual({
      ...INITIAL_LESSON,
      mode: "pictures",
      index: 1,
    });
  });

  it("keeps the card when the mode on screen is chosen again", () => {
    const third = run(10, INITIAL_LESSON, NEXT, NEXT);

    expect(lessonReducer(third, PICTURES, 10)).toBe(third);
  });

  it("moves from the last card there is when the words have become fewer", () => {
    const tenth: LessonState = { ...INITIAL_LESSON, index: 9 };

    expect(lessonReducer(tenth, BACK, 8).index).toBe(6);
    expect(lessonReducer(tenth, NEXT, 8)).toMatchObject({
      index: 7,
      finished: true,
    });
  });
});

describe("cardIndex, isFirstCard and isLastCard", () => {
  it("know the lesson's first card", () => {
    expect(isFirstCard(INITIAL_LESSON, 2)).toBe(true);
    expect(isFirstCard(lessonReducer(INITIAL_LESSON, NEXT, 2), 2)).toBe(false);
  });

  it("know the lesson's last card, even when the words have become fewer", () => {
    expect(isLastCard(INITIAL_LESSON, 2)).toBe(false);
    expect(isLastCard(lessonReducer(INITIAL_LESSON, NEXT, 2), 2)).toBe(true);
    expect(isLastCard({ ...INITIAL_LESSON, index: 9 }, 8)).toBe(true);
    expect(isLastCard(INITIAL_LESSON, 1)).toBe(true);
  });

  it("keep the card within the words there are", () => {
    expect(cardIndex({ ...INITIAL_LESSON, index: 9 }, 8)).toBe(7);
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
