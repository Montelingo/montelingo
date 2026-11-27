import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { drawPuzzle } from "../model/gate";
import { grantEntry, hasEntry } from "./gate-entry";
import { GrownUpsGate } from "./GrownUpsGate";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

// With Math.random at 0, the dialog draws this puzzle.
const PUZZLE = drawPuzzle(() => 0);

function renderGate() {
  return render(
    <GrownUpsGate closeHref="/play/me">
      <h1>Za roditelje</h1>
    </GrownUpsGate>,
  );
}

function area() {
  return screen.queryByRole("heading", { level: 1, name: "Za roditelje" });
}

beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("GrownUpsGate", () => {
  it("shows the gate first, and not the area", () => {
    renderGate();

    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    expect(area()).not.toBeInTheDocument();
  });

  it("shows the area once the gate is passed", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    const user = userEvent.setup();
    renderGate();

    await user.pointer({
      keys: "[MouseLeft>]",
      target: screen.getByRole("button", { name: String(PUZZLE.target) }),
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(area()).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("goes back to the Ja screen when the gate is closed", async () => {
    const user = userEvent.setup();
    renderGate();

    await user.keyboard("{Escape}");

    expect(router.replace).toHaveBeenCalledWith("/play/me");
    expect(area()).not.toBeInTheDocument();
  });

  it("lets the area in once, right after the gate was passed on the Ja screen", () => {
    grantEntry();
    const { unmount } = renderGate();

    expect(area()).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(hasEntry()).toBe(false);

    unmount();
    renderGate();

    expect(area()).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = renderGate();

    expect(await axe(container)).toHaveNoViolations();
  });
});
