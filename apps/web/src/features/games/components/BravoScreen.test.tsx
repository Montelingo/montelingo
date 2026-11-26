import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import {
  BravoScreen,
  type BravoScreenProps,
  starsText,
  wordsLearnedText,
} from "./BravoScreen";
import { SETTLE_DELAY_MS } from "@/lib/use-settled";

const PLACE_HREF = "/play/coast/budva";

function renderBravo(props: Partial<BravoScreenProps> = {}) {
  return render(
    <BravoScreen
      message="Sad znaš još 6 novih riječi."
      placeHref={PLACE_HREF}
      backLabel="Nazad na mjesto"
      learnerName={undefined}
      reward={null}
      onPlayAgain={() => {}}
      {...props}
    />,
  );
}

function heading() {
  return screen.getByRole("heading", { level: 2 });
}

function playAgain() {
  return screen.getByRole("button", { name: "Igraj ponovo" });
}

describe("BravoScreen", () => {
  it("praises, with the focus on the heading, and shows the message", () => {
    renderBravo();

    expect(heading()).toHaveTextContent("Bravo!");
    expect(heading()).toHaveFocus();
    expect(screen.getByText("Sad znaš još 6 novih riječi.")).toBeVisible();
    expect(heading().closest("[lang]")).toHaveAttribute("lang", "sr-Latn-ME");
  });

  it("praises the learner by name", () => {
    renderBravo({ learnerName: "Mia" });

    expect(heading()).toHaveTextContent("Bravo, Mia!");
  });

  it("leads back to the place", () => {
    renderBravo();

    expect(
      screen.getByRole("link", { name: "Nazad na mjesto" }),
    ).toHaveAttribute("href", PLACE_HREF);
  });

  it("shows the place's sticker only when given one", () => {
    const { rerender } = renderBravo({
      reward: { placeId: "kotor", name: "Kotorske zidine", stars: 3 },
    });
    expect(screen.getByText("Nova naljepnica")).toBeVisible();
    expect(screen.getByText("Kotorske zidine")).toBeVisible();
    expect(screen.getByText("+3 zvjezdice")).toBeVisible();

    rerender(
      <BravoScreen
        message="Svi parovi su pronađeni!"
        placeHref={PLACE_HREF}
        backLabel="Nazad na mjesto"
        learnerName={undefined}
        reward={null}
        onPlayAgain={() => {}}
      />,
    );
    expect(screen.queryByText("Nova naljepnica")).not.toBeInTheDocument();
  });

  describe("with a fake clock", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("ignores the buttons for a moment, so a tap meant for the game presses neither", () => {
      const onPlayAgain = vi.fn();
      renderBravo({ onPlayAgain });

      fireEvent.click(playAgain());
      expect(onPlayAgain).not.toHaveBeenCalled();
      const early = fireEvent.click(
        screen.getByRole("link", { name: "Nazad na mjesto" }),
      );
      expect(early).toBe(false);

      act(() => {
        vi.advanceTimersByTime(SETTLE_DELAY_MS);
      });
      fireEvent.click(playAgain());
      expect(onPlayAgain).toHaveBeenCalledTimes(1);
    });
  });

  it("has no axe violations with a sticker", async () => {
    const { container } = renderBravo({
      learnerName: "Mia",
      reward: { placeId: "kotor", name: "Kotorske zidine", stars: 3 },
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Bravo! copy", () => {
  it("counts the words in Montenegrin's forms", () => {
    expect(wordsLearnedText(1)).toBe("Sad znaš još 1 novu riječ.");
    expect(wordsLearnedText(3)).toBe("Sad znaš još 3 nove riječi.");
    expect(wordsLearnedText(6)).toBe("Sad znaš još 6 novih riječi.");
  });

  it("counts the stars in Montenegrin's forms", () => {
    expect(starsText(1)).toBe("+1 zvjezdica");
    expect(starsText(3)).toBe("+3 zvjezdice");
    expect(starsText(5)).toBe("+5 zvjezdica");
  });
});
