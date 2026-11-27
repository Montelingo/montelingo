import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { drawPuzzle, type GatePuzzle, numberWord } from "../model/gate";
import { clearEntry, hasEntry } from "./gate-entry";
import { GrownUpsGateButton } from "./GrownUpsGateButton";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

// With Math.random at 0, the dialog draws this puzzle.
const PUZZLE = drawPuzzle(() => 0);

function heading(puzzle: GatePuzzle): string {
  return `Pritisni i drži broj ${numberWord(puzzle.target)}`;
}

function renderRow() {
  render(
    <GrownUpsGateButton href="/play/me/grown-ups">
      Za roditelje
    </GrownUpsGateButton>,
  );
  return screen.getByRole("button", { name: "Za roditelje" });
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
  clearEntry();
});

describe("GrownUpsGateButton", () => {
  it("opens the gate over the screen, without leaving it", async () => {
    const user = userEvent.setup();
    const row = renderRow();
    expect(row).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(row);

    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("puts the focus back on the row when the gate is closed with Escape", async () => {
    const user = userEvent.setup();
    const row = renderRow();

    await user.click(row);
    expect(row).not.toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(row).toHaveFocus();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("opens the grown-ups area once the gate is passed, letting it in", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    const user = userEvent.setup();
    const row = renderRow();

    await user.click(row);
    await user.pointer({
      keys: "[MouseLeft>]",
      target: screen.getByRole("button", { name: String(PUZZLE.target) }),
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(router.push).toHaveBeenCalledWith("/play/me/grown-ups");
    expect(hasEntry()).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("draws a new puzzle each time the gate opens", async () => {
    const user = userEvent.setup();
    const row = renderRow();

    await user.click(row);
    expect(screen.getByRole("dialog")).toHaveAccessibleName(heading(PUZZLE));
    await user.keyboard("{Escape}");
    vi.mocked(Math.random).mockReturnValue(0.999);
    await user.click(row);

    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      heading(drawPuzzle(() => 0.999)),
    );
  });
});
