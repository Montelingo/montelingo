import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { drawPuzzle, type GatePuzzle, numberWord } from "../model/gate";
import { seededRandom } from "../test-random";
import { GateDialog } from "./GateDialog";

const SEED = 11;

// The puzzles the dialog will draw, in order, from a twin of its random source.
function puzzles(count: number): GatePuzzle[] {
  const random = seededRandom(SEED);
  return Array.from({ length: count }, () => drawPuzzle(random));
}

const [FIRST, SECOND, THIRD] = puzzles(3) as [
  GatePuzzle,
  GatePuzzle,
  GatePuzzle,
];

// The hold's clock.
const CLOCK = ["setInterval", "clearInterval", "Date"] as const;

const onPass = vi.fn();
const onCancel = vi.fn();

function renderGate() {
  return render(
    <GateDialog
      onPass={onPass}
      onCancel={onCancel}
      random={seededRandom(SEED)}
    />,
  );
}

function headingFor(puzzle: GatePuzzle): string {
  return `Pritisni i drži broj ${numberWord(puzzle.target)}`;
}

function digitButton(digit: number) {
  return screen.getByRole("button", { name: String(digit) });
}

function wrongDigit(puzzle: GatePuzzle): number {
  return puzzle.digits.find((digit) => digit !== puzzle.target) as number;
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("GateDialog", () => {
  let user: ReturnType<typeof userEvent.setup>;

  // The hold's clock is fake; timeouts stay real, for userEvent and for the
  // shake before a new puzzle, which `findBy…` waits for.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: [...CLOCK] });
    user = userEvent.setup();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function press(digit: number) {
    await user.pointer({ keys: "[MouseLeft>]", target: digitButton(digit) });
  }

  async function release(digit: number) {
    await user.pointer({ keys: "[/MouseLeft]", target: digitButton(digit) });
  }

  // A wrong digit: the digits shake, then the new puzzle is announced.
  async function pressWrong(puzzle: GatePuzzle) {
    await press(wrongDigit(puzzle));
    await release(wrongDigit(puzzle));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Pokušaj ponovo"),
    );
  }

  it("opens as a modal, named by the number to hold, written out", () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    renderGate();

    const dialog = screen.getByRole("dialog", { name: headingFor(FIRST) });
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(dialog).toHaveTextContent("Samo za roditelje");
    expect(dialog).toHaveTextContent(
      "Brojevi napisani slovima čuvaju podešavanja od malih ruku.",
    );
    showModal.mockRestore();
  });

  it("offers four different digits, the target among them", () => {
    renderGate();

    const dialog = screen.getByRole("dialog");
    const digits = within(dialog)
      .getAllByRole("button")
      .filter((button) => /^\d$/.test(button.textContent ?? ""))
      .map((button) => Number(button.textContent));
    expect(digits).toEqual(FIRST.digits);
    expect(digits).toContain(FIRST.target);
  });

  it("passes once the right digit is held to the end", async () => {
    renderGate();

    await press(FIRST.target);
    wait(1500);

    expect(onPass).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("says the hold is under way in a live region", async () => {
    renderGate();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toBeEmptyDOMElement();

    await press(FIRST.target);
    wait(500);

    expect(status).toHaveTextContent("Držiš… samo nastavi");
    expect(onPass).not.toHaveBeenCalled();
  });

  it("does not pass when the digit is let go early", async () => {
    renderGate();

    await press(FIRST.target);
    wait(1000);
    await release(FIRST.target);
    wait(2000);

    expect(onPass).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(
      screen.getByRole("dialog", { name: headingFor(FIRST) }),
    ).toBeInTheDocument();
  });

  it("draws a new puzzle after a wrong digit", async () => {
    renderGate();

    await pressWrong(FIRST);

    expect(
      screen.getByRole("dialog", { name: headingFor(SECOND) }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      `Pokušaj ponovo. ${headingFor(SECOND)}.`,
    );
    expect(onPass).not.toHaveBeenCalled();
  });

  it("never locks out: after wrong digits the right one still passes", async () => {
    renderGate();

    await pressWrong(FIRST);
    await pressWrong(SECOND);
    await press(THIRD.target);
    wait(1500);

    expect(onPass).toHaveBeenCalledOnce();
  });

  it.each(["Space", "Enter"])(
    "passes when %s is held on the right digit",
    async (key) => {
      renderGate();
      digitButton(FIRST.target).focus();

      await user.keyboard(`[${key}>]`);
      wait(1500);

      expect(onPass).toHaveBeenCalledOnce();
    },
  );

  it("does not pass when the key is let go early", async () => {
    renderGate();
    digitButton(FIRST.target).focus();

    await user.keyboard("[Space>]");
    wait(700);
    await user.keyboard("[/Space]");
    wait(2000);

    expect(onPass).not.toHaveBeenCalled();
  });

  it("closes with Escape", async () => {
    renderGate();

    await user.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onPass).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes with the close button", async () => {
    renderGate();

    await user.click(screen.getByRole("button", { name: "Zatvori" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onPass).not.toHaveBeenCalled();
  });
});

describe("GateDialog accessibility", () => {
  it("has no accessibility violations", async () => {
    const { container } = renderGate();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations while a digit is held", async () => {
    // The hold's clock stands still, so it cannot finish during the check;
    // axe's own timeouts stay real.
    vi.useFakeTimers({ toFake: [...CLOCK] });
    const { container } = renderGate();

    await userEvent.pointer({
      keys: "[MouseLeft>]",
      target: digitButton(FIRST.target),
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Držiš");

    expect(await axe(container)).toHaveNoViolations();
    vi.useRealTimers();
  });
});
