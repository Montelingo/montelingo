import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { stubImageDecode } from "@/components/ui/test-image-decode";
import { PICTURES_READY_TIMEOUT_MS } from "@/components/ui/use-word-pictures-ready";

import type { MemoryWord } from "../model/memory";
import {
  BRAVO_DELAY_MS,
  MemoryGame,
  type MemoryGameProps,
  MISS_DELAY_MS,
  SETTLE_DELAY_MS,
} from "./MemoryGame";

// "Na plaži" (Budva, words 1–6): six pictures, so a full board of 12 cards.
const TEXTS = ["more", "plaža", "pijesak", "sunce", "talas", "obala"];

function makeWords(): MemoryWord[] {
  return TEXTS.map((text, index) => {
    const number = String(index + 1).padStart(4, "0");
    return {
      id: `word-${index + 1}`,
      text,
      imageUrl: `/media/words/${number}.webp`,
      imageUrl512: `/media/words/${number}-512.webp`,
    };
  });
}

// Fisher–Yates swaps item i with item ⌊random · (i + 1)⌋: just under 1 keeps
// every item where it is. The deal is then the words in order, two cards
// each: cards 1 and 2 are "more", 3 and 4 "plaža", and so on.
const NO_SHUFFLE = () => 0.999;

const PLACE_HREF = "/play/coast/kotor";

/**
 * A random source that keeps drawing, as `Math.random` does: the server's
 * render and the browser's hydration each take the next numbers from it, so
 * they deal differently, as they do in production.
 */
function drawingRandom(): () => number {
  let seed = 42;
  return () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
}

/**
 * The game as a full page load gets it: its server HTML, then hydrated in the
 * browser. Returns the page and the hydration's recoverable errors.
 */
function hydrate(element: ReactElement) {
  const container = document.createElement("div");
  container.innerHTML = renderToString(element);
  document.body.append(container);
  const onRecoverableError = vi.fn();
  let root: Root | undefined;
  act(() => {
    root = hydrateRoot(container, element, { onRecoverableError });
  });
  return {
    container,
    onRecoverableError,
    cleanUp() {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
  };
}

function renderGame(props: Partial<MemoryGameProps> = {}) {
  return render(
    <MemoryGame
      words={makeWords()}
      placeHref={PLACE_HREF}
      random={NO_SHUFFLE}
      {...props}
    />,
  );
}

/** Finds every pair of an unshuffled board: cards 1 and 2, 3 and 4, … */
function findAllPairs() {
  for (let position = 1; position <= TEXTS.length * 2; position += 2) {
    tap(position);
    tap(position + 1);
  }
}

/** Every pair found, the last one shown, and "Bravo!" settled. */
function playToBravo() {
  findAllPairs();
  wait(BRAVO_DELAY_MS);
  wait(SETTLE_DELAY_MS);
}

function bravo() {
  return screen.queryByRole("heading", { name: /^Bravo/ });
}

function playAgain() {
  return screen.getByRole("button", { name: "Igraj ponovo" });
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

  it("shows the last pair a moment, then Bravo! with the focus on it", () => {
    renderGame();

    findAllPairs();
    expect(bravo()).not.toBeInTheDocument();
    expect(card(12)).toHaveAccessibleName("obala, par pronađen");

    wait(BRAVO_DELAY_MS);
    expect(bravo()).toHaveTextContent("Bravo!");
    expect(bravo()).toHaveFocus();
    expect(screen.getByText("Sad znaš još 6 novih riječi.")).toBeVisible();
    expect(bravo()?.closest("[lang]")).toHaveAttribute("lang", "sr-Latn-ME");
    expect(
      screen.getByRole("link", { name: "Nazad na mjesto" }),
    ).toHaveAttribute("href", PLACE_HREF);
    expect(playAgain()).toBeVisible();
  });

  it("praises the learner by name", () => {
    renderGame({ learnerName: "Mia" });

    playToBravo();

    expect(bravo()).toHaveTextContent("Bravo, Mia!");
  });

  it("calls onCompleted once, when the last pair is found, and not again on a second game", () => {
    const onCompleted = vi.fn();
    renderGame({ onCompleted });

    findAllPairs();
    expect(onCompleted).toHaveBeenCalledTimes(1);

    wait(BRAVO_DELAY_MS);
    wait(SETTLE_DELAY_MS);
    fireEvent.click(playAgain());
    playToBravo();

    expect(bravo()).toBeInTheDocument();
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("deals a new shuffle on Igraj ponovo, with the focus on the first card", () => {
    const random = vi.fn(NO_SHUFFLE);
    renderGame({ random });
    playToBravo();

    // Just above 0 moves the last item to the front, every swap: the words
    // come out plaža … obala, more, and the cards one step further on, so
    // card 1 is plaža's second card.
    random.mockImplementation(() => 0);
    fireEvent.click(playAgain());

    expect(bravo()).not.toBeInTheDocument();
    expect(card(1)).toHaveFocus();
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAccessibleName(/licem dolje$/);
    }
    tap(1);
    expect(card(1)).toHaveAccessibleName("plaža");
  });

  it("ignores the Bravo! buttons for a moment, so a tap meant for a card presses neither", () => {
    renderGame();
    findAllPairs();
    wait(BRAVO_DELAY_MS);

    fireEvent.click(playAgain());
    expect(bravo()).toBeInTheDocument();

    wait(SETTLE_DELAY_MS);
    fireEvent.click(playAgain());
    expect(bravo()).not.toBeInTheDocument();
  });

  it("shows the place's sticker when the game completes the place", () => {
    renderGame({
      reward: { placeId: "kotor", name: "Kotorske zidine", stars: 3 },
    });

    playToBravo();

    expect(screen.getByText("Nova naljepnica")).toBeVisible();
    expect(screen.getByText("Kotorske zidine")).toBeVisible();
    expect(screen.getByText("+3 zvjezdice")).toBeVisible();
  });

  it("gives the sticker and the new words once: a second game only praises", () => {
    renderGame({
      reward: { placeId: "kotor", name: "Kotorske zidine", stars: 3 },
    });
    playToBravo();
    fireEvent.click(playAgain());

    playToBravo();

    expect(bravo()).toBeInTheDocument();
    expect(screen.queryByText("Nova naljepnica")).not.toBeInTheDocument();
    expect(screen.queryByText(/novih riječi/)).not.toBeInTheDocument();
    expect(screen.getByText("Svi parovi su pronađeni!")).toBeVisible();
  });

  it("leads back where it is told, with its own label", () => {
    renderGame({ placeHref: "/play/words", backLabel: "Nazad na riječi" });

    playToBravo();

    expect(
      screen.getByRole("link", { name: "Nazad na riječi" }),
    ).toHaveAttribute("href", "/play/words");
  });

  it("only praises a game that teaches no new words, such as practice", () => {
    renderGame({ teachesWords: false });

    playToBravo();

    expect(screen.queryByText(/novih riječi/)).not.toBeInTheDocument();
    expect(screen.getByText("Svi parovi su pronađeni!")).toBeVisible();
  });

  it("shows no sticker otherwise", () => {
    renderGame();

    playToBravo();

    expect(screen.queryByText("Nova naljepnica")).not.toBeInTheDocument();
  });
});

// Real timers: user-event and axe wait on them.
// A full page load renders the game on the server and hydrates it in the
// browser. React keeps the server's pictures where the deals differ, so the
// game must be dealt in the browser only.
describe("MemoryGame after a full page load", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("shows each turned card's own picture, and hydrates without errors", () => {
    const random = drawingRandom();
    const page = hydrate(
      <MemoryGame words={makeWords()} placeHref={PLACE_HREF} random={random} />,
    );
    const pictureOf = new Map(
      makeWords().map(({ text, imageUrl }) => [text, imageUrl]),
    );

    const cards = within(page.container).getAllByRole("button");
    expect(cards).toHaveLength(TEXTS.length * 2);
    for (let index = 0; index < cards.length; index += 2) {
      const turn = cards.slice(index, index + 2);
      for (const turned of turn) {
        fireEvent.click(turned);
      }
      for (const turned of turn) {
        const word = turned.getAttribute("aria-label")?.split(",")[0];
        expect(turned.querySelector("img")).toHaveAttribute(
          "src",
          pictureOf.get(word ?? ""),
        );
      }
      wait(MISS_DELAY_MS);
    }
    expect(page.onRecoverableError).not.toHaveBeenCalled();
    page.cleanUp();
  });
});

describe("MemoryGame with the keyboard and axe", () => {
  it("plays with the keyboard: Tab to a card, Enter or Space turns it", async () => {
    const user = userEvent.setup();
    renderGame();

    await user.tab();
    expect(card(1)).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.tab();
    await user.keyboard(" ");

    expect(card(1)).toHaveAccessibleName("more, par pronađen");
    expect(card(2)).toHaveAccessibleName("more, par pronađen");
  });

  it("has no axe violations on the board", async () => {
    const { container } = renderGame();
    tap(1);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations on Bravo! with a sticker", async () => {
    const { container } = renderGame({
      learnerName: "Mia",
      reward: { placeId: "kotor", name: "Kotorske zidine", stars: 3 },
    });
    findAllPairs();
    await screen.findByRole(
      "heading",
      { name: "Bravo, Mia!" },
      { timeout: 3000 },
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("MemoryGame while its pictures load", () => {
  let decode: ReturnType<typeof stubImageDecode>;

  beforeEach(() => {
    decode = stubImageDecode();
  });

  afterEach(() => {
    decode.restore();
    vi.useRealTimers();
  });

  function board() {
    return screen.queryByRole("group", { name: "Memorija" });
  }

  it("shows a block for each card, not the board, until every picture is decoded", async () => {
    renderGame();

    expect(board()).not.toBeInTheDocument();
    expect(screen.getAllByTestId("memory-card-skeleton")).toHaveLength(
      TEXTS.length * 2,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");

    await act(() => decode.loadAll());

    expect(board()).toBeInTheDocument();
    expect(
      screen.queryByTestId("memory-card-skeleton"),
    ).not.toBeInTheDocument();
  });

  it("decodes each picture once, choosing the 512 px file as the cards do", () => {
    renderGame();

    expect(decode.requests).toHaveLength(TEXTS.length);
    for (const [index, request] of decode.requests.entries()) {
      const number = String(index + 1).padStart(4, "0");
      expect(request.srcset).toBe(
        `/media/words/${number}-512.webp 512w, /media/words/${number}.webp 1024w`,
      );
      expect(request.sizes).toBe(
        "(orientation: landscape) min(25vw, 18rem), 33vw",
      );
    }
  });

  it("gives the cards the same choice of files", async () => {
    renderGame();
    await act(() => decode.loadAll());

    fireEvent.click(card(1));

    const image = card(1).querySelector("img");
    expect(image).toHaveAttribute(
      "srcset",
      "/media/words/0001-512.webp 512w, /media/words/0001.webp 1024w",
    );
    expect(image).toHaveAttribute("sizes", decode.requests[0]?.sizes);
  });

  it("starts anyway when a picture fails, which shows the placeholder", async () => {
    renderGame();

    await act(() => decode.failFirst());

    expect(board()).toBeInTheDocument();
  });

  it("starts anyway when a picture never arrives", () => {
    vi.useFakeTimers();
    renderGame();

    wait(PICTURES_READY_TIMEOUT_MS - 1);
    expect(board()).not.toBeInTheDocument();

    wait(1);
    expect(board()).toBeInTheDocument();
  });

  it("gives the first card the focus after Igraj ponovo, once the cards appear", async () => {
    vi.useFakeTimers();
    renderGame();
    await act(() => decode.loadAll());
    playToBravo();

    fireEvent.click(playAgain());
    expect(board()).not.toBeInTheDocument();
    await act(() => decode.loadAll());

    expect(card(1)).toHaveFocus();
  });
});
