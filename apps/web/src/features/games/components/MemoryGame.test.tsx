import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MemoryWord } from "../model/memory";
import { MemoryGame, MISS_DELAY_MS } from "./MemoryGame";

// "Na plaži" (Budva, words 1–6): six pictures, so a full board of 12 cards.
const TEXTS = ["more", "plaža", "pijesak", "sunce", "talas", "obala"];

function makeWords(): MemoryWord[] {
  return TEXTS.map((text, index) => {
    const number = String(index + 1).padStart(4, "0");
    return {
      id: `word-${index + 1}`,
      text,
      imageUrl: `/media/words/${number}.webp`,
    };
  });
}

// Fisher–Yates swaps item i with item ⌊random · (i + 1)⌋: just under 1 keeps
// every item where it is. The deal is then the words in order, two cards
// each: cards 1 and 2 are "more", 3 and 4 "plaža", and so on.
const NO_SHUFFLE = () => 0.999;

function renderGame() {
  return render(<MemoryGame words={makeWords()} random={NO_SHUFFLE} />);
}

/** Tap a card. A plain click: the miss's timer is faked, so a tap must not wait. */
function tap(position: number) {
  fireEvent.click(card(position));
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** A card by its place on the board, counted from 1 as a child would. */
function card(position: number) {
  const cards = screen.getAllByRole("button");
  const found = cards[position - 1];
  if (found === undefined) {
    throw new Error(`no card ${position}`);
  }
  return found;
}

describe("MemoryGame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a found pair turned over", () => {
    renderGame();

    tap(1);
    tap(2);
    wait(MISS_DELAY_MS * 5);

    expect(card(1)).toHaveAccessibleName("more, par pronađen");
    expect(card(2)).toHaveAccessibleName("more, par pronađen");
  });

  it("shows a miss for about a second, then turns it back", () => {
    renderGame();

    tap(2);
    tap(3);
    expect(card(2)).toHaveAccessibleName("more");
    expect(card(3)).toHaveAccessibleName("plaža");

    wait(MISS_DELAY_MS - 200);
    expect(card(3)).toHaveAccessibleName("plaža");

    wait(200);
    expect(card(2)).toHaveAccessibleName("karta 2, licem dolje");
    expect(card(3)).toHaveAccessibleName("karta 3, licem dolje");
  });

  it("writes a found pair's word under its pictures, and no other", () => {
    renderGame();

    tap(1);
    expect(within(card(1)).queryByText("more")).not.toBeInTheDocument();

    tap(2);
    expect(within(card(1)).getByText("more")).toBeVisible();
    expect(within(card(2)).getByText("more")).toBeVisible();
    expect(screen.queryByText("plaža")).not.toBeInTheDocument();
  });

  // jsdom applies no CSS, so these two read the class names that do the work.
  it("lays the board out 3 × 4 in portrait and 4 × 3 in landscape", () => {
    renderGame();

    expect(screen.getByRole("group", { name: "Memorija" })).toHaveClass(
      "grid-cols-3",
      "grid-rows-4",
      "landscape:grid-cols-4",
      "landscape:grid-rows-3",
    );
  });

  it("turns a card with an animation only when motion is allowed", () => {
    renderGame();

    const turning = card(1).firstElementChild;
    expect(turning).toHaveClass("motion-safe:transition-transform");
    expect(turning).not.toHaveClass("transition-transform");

    tap(1);
    expect(turning).toHaveClass("[transform:rotateY(180deg)]");
  });

  it("takes no taps while a miss is showing", () => {
    renderGame();

    tap(2);
    tap(3);
    tap(5);
    tap(6);

    expect(card(5)).toHaveAccessibleName("karta 5, licem dolje");
    expect(card(6)).toHaveAccessibleName("karta 6, licem dolje");
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("aria-disabled", "true");
    }

    wait(MISS_DELAY_MS);
    expect(card(5)).toHaveAttribute("aria-disabled", "false");
    tap(5);
    expect(card(5)).toHaveAccessibleName("pijesak");
  });
});
