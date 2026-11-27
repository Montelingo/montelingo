import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useGameVisit } from "./use-game-visit";

function renderVisit(everyGame?: boolean) {
  const onCompleted = vi.fn();
  const view = renderHook(
    ({ isFinished }: { isFinished: boolean }) =>
      useGameVisit(isFinished, onCompleted, everyGame),
    { initialProps: { isFinished: false } },
  );
  /** Ends the current game, then deals the next. */
  function finishThenPlayAgain() {
    view.rerender({ isFinished: true });
    act(() => view.result.current.playAgain());
    view.rerender({ isFinished: false });
  }
  return { ...view, onCompleted, finishThenPlayAgain };
}

describe("useGameVisit", () => {
  it("reports a chapter's game once a visit, however often it is played (ADR 0006)", () => {
    const { onCompleted, finishThenPlayAgain, rerender, result } =
      renderVisit();

    finishThenPlayAgain();
    finishThenPlayAgain();
    rerender({ isFinished: true });

    expect(onCompleted).toHaveBeenCalledTimes(1);
    expect(result.current.isReplay).toBe(true);
  });

  it("reports every game when asked to, once each, as practice is (ADR 0009)", () => {
    const { onCompleted, finishThenPlayAgain, rerender } = renderVisit(true);

    finishThenPlayAgain();
    finishThenPlayAgain();
    rerender({ isFinished: true });
    rerender({ isFinished: true });

    expect(onCompleted).toHaveBeenCalledTimes(3);
  });

  it("reports nothing before a game ends", () => {
    const { onCompleted } = renderVisit(true);

    expect(onCompleted).not.toHaveBeenCalled();
  });
});
