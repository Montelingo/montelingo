import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { CONTENT_LANG } from "@/features/map/edge";

import type { MatchWord } from "../model/match";
import {
  MatchGame,
  type MatchGameProps,
  RIGHT_DELAY_MS,
  SETTLE_DELAY_MS,
} from "./MatchGame";

// "Na plaži" (Budva, words 1–6), each with its picture: six rounds.
const TEXTS = ["More", "plaža", "pijesak", "sunce", "talas", "obala"];

function makeWords(): MatchWord[] {
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
// every item where it is. The rounds then come in the words' order, and each
// offers its word first, then the first two others: round 1 is "more" with
// "plaža" and "pijesak", round 2 "plaža" with "more" and "pijesak".
const NO_SHUFFLE = () => 0.999;

const PLACE_HREF = "/play/coast/budva";

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

function renderGame(props: Partial<MatchGameProps> = {}) {
  return render(
    <MatchGame
      words={makeWords()}
      placeHref={PLACE_HREF}
      random={NO_SHUFFLE}
      {...props}
    />,
  );
}

function picture() {
  return within(game()).getByRole("img");
}

function game() {
  return screen.getByRole("group", { name: "Spoji riječ i sliku" });
}

function options() {
  return within(game()).getAllByRole("button");
}

function option(name: string) {
  return within(game()).getByRole("button", { name });
}

function dots() {
  return screen.getByTestId("match-dots").children;
}

function bravo() {
  return screen.queryByRole("heading", { name: /^Bravo/ });
}

function playAgain() {
  return screen.getByRole("button", { name: "Igraj ponovo" });
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Tap the round's right word (an unshuffled round offers it first). */
function solveRound() {
  const [right] = options();
  if (right === undefined) {
    throw new Error("no options");
  }
  fireEvent.click(right);
  wait(RIGHT_DELAY_MS);
}

/** Every round solved, and "Bravo!" settled. */
function playToBravo() {
  for (let round = 0; round < TEXTS.length; round += 1) {
    solveRound();
  }
  wait(SETTLE_DELAY_MS);
}

describe("MatchGame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a picture and three words, the right one among them", () => {
    renderGame();

    expect(picture()).toHaveAccessibleName("More");
    expect(picture().querySelector("img")).toHaveAttribute(
      "src",
      "/media/words/0001.webp",
    );
    expect(options().map((button) => button.textContent)).toEqual([
      "more",
      "plaža",
      "pijesak",
    ]);
  });

  it("writes the words in lowercase, in the content's language", () => {
    renderGame();

    expect(option("more")).toBeVisible();
    expect(game()).toHaveAttribute("lang", "sr-Latn-ME");
  });

  it("sets a wrong word aside, and stays on the picture to pick again", () => {
    renderGame();

    fireEvent.click(option("plaža"));
    wait(RIGHT_DELAY_MS);

    expect(picture()).toHaveAccessibleName("More");
    expect(option("plaža")).toHaveAttribute("aria-disabled", "true");
    expect(option("plaža")).toHaveClass(
      "opacity-40",
      "motion-safe:animate-wiggle",
    );
    expect(option("more")).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByRole("status")).toHaveTextContent("Pokušaj ponovo.");
    expect(dots()[0]).toHaveAttribute("data-current", "true");
  });

  it("takes no tap on a word set aside", () => {
    renderGame();
    fireEvent.click(option("plaža"));

    fireEvent.click(option("plaža"));
    fireEvent.click(option("more"));

    expect(screen.getByRole("status")).toHaveTextContent("Tačno!");
  });

  it("shows the right word a moment, then the next picture", () => {
    renderGame();

    fireEvent.click(option("more"));
    expect(screen.getByRole("status")).toHaveTextContent("Tačno!");
    expect(picture()).toHaveAccessibleName("More");
    for (const button of options()) {
      expect(button).toHaveAttribute("aria-disabled", "true");
    }

    wait(RIGHT_DELAY_MS);
    expect(picture()).toHaveAccessibleName("plaža");
    expect(options().map((button) => button.textContent)).toEqual([
      "plaža",
      "more",
      "pijesak",
    ]);
    expect(screen.getByRole("status")).toHaveTextContent("Slika 2 od 6");
  });

  it("shows a dot per round: the done ones, then the current one", () => {
    renderGame();
    expect(dots()).toHaveLength(6);

    solveRound();
    solveRound();

    expect([...dots()].map((dot) => dot.getAttribute("data-done"))).toEqual([
      "true",
      "true",
      "false",
      "false",
      "false",
      "false",
    ]);
    expect(dots()[2]).toHaveAttribute("data-current", "true");
  });

  it("shows Bravo! after the last round, with the focus on it", () => {
    renderGame();

    for (let round = 0; round < TEXTS.length - 1; round += 1) {
      solveRound();
    }
    expect(bravo()).not.toBeInTheDocument();
    solveRound();

    expect(bravo()).toHaveTextContent("Bravo!");
    expect(bravo()).toHaveFocus();
    expect(screen.getByText("Sad znaš još 6 novih riječi.")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Nazad na mjesto" }),
    ).toHaveAttribute("href", PLACE_HREF);
  });

  it("praises the learner by name", () => {
    renderGame({ learnerName: "Mia" });

    playToBravo();

    expect(bravo()).toHaveTextContent("Bravo, Mia!");
  });

  it("calls onCompleted once, when the last round is solved, and not again on a second game", () => {
    const onCompleted = vi.fn();
    renderGame({ onCompleted });

    for (let round = 0; round < TEXTS.length - 1; round += 1) {
      solveRound();
    }
    expect(onCompleted).not.toHaveBeenCalled();
    solveRound();
    expect(onCompleted).toHaveBeenCalledTimes(1);

    wait(SETTLE_DELAY_MS);
    fireEvent.click(playAgain());
    playToBravo();

    expect(bravo()).toBeInTheDocument();
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("deals a new game on Igraj ponovo, with the focus on its first word, and only praises at its end", () => {
    renderGame({
      reward: { placeId: "budva", name: "Budva", stars: 3 },
    });
    playToBravo();
    expect(screen.getByText("Nova naljepnica")).toBeVisible();

    fireEvent.click(playAgain());
    expect(bravo()).not.toBeInTheDocument();
    expect(option("more")).toHaveFocus();
    expect(dots()[0]).toHaveAttribute("data-current", "true");

    playToBravo();
    expect(screen.getByText("Sve riječi su pronađene!")).toBeVisible();
    expect(screen.queryByText("Nova naljepnica")).not.toBeInTheDocument();
  });

  it("ignores the Bravo! buttons for a moment, so a tap meant for a word presses neither", () => {
    renderGame();
    for (let round = 0; round < TEXTS.length; round += 1) {
      solveRound();
    }

    fireEvent.click(playAgain());
    expect(bravo()).toBeInTheDocument();

    wait(SETTLE_DELAY_MS);
    fireEvent.click(playAgain());
    expect(bravo()).not.toBeInTheDocument();
  });

  it("plays only as many rounds as its cap", () => {
    renderGame({ rounds: 3 });

    expect(dots()).toHaveLength(3);
    solveRound();
    solveRound();
    solveRound();
    wait(SETTLE_DELAY_MS);

    expect(screen.getByText("Sad znaš još 3 nove riječi.")).toBeVisible();
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

    expect(screen.queryByText(/riječi\./)).not.toBeInTheDocument();
    expect(screen.getByText("Sve riječi su pronađene!")).toBeVisible();
  });

  it("shows nothing for words that deal no game", () => {
    const { container } = renderGame({ words: makeWords().slice(0, 2) });

    expect(container).toBeEmptyDOMElement();
  });
});

// Real timers: user-event and axe wait on them.
// A full page load renders the game on the server and hydrates it in the
// browser, so the game must be dealt in the browser only: two deals would not
// hydrate, and React would throw the server's away.
describe("MatchGame after a full page load", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows a picture with its own word on offer, and hydrates without errors", () => {
    const page = hydrate(
      <MatchGame
        words={makeWords()}
        placeHref={PLACE_HREF}
        random={drawingRandom()}
      />,
    );

    const round = within(page.container).getByRole("group", {
      name: "Spoji riječ i sliku",
    });
    const word = makeWords().find(
      ({ text }) => text === within(round).getByRole("img").ariaLabel,
    );
    expect(word).toBeDefined();
    expect(round.querySelector("img")).toHaveAttribute("src", word?.imageUrl);
    expect(
      within(round).getByRole("button", {
        name: word?.text.toLocaleLowerCase(CONTENT_LANG),
      }),
    ).toBeInTheDocument();
    expect(page.onRecoverableError).not.toHaveBeenCalled();
    page.cleanUp();
  });
});

describe("MatchGame with the keyboard and axe", () => {
  it("plays with the keyboard, and keeps the focus on the words between rounds", async () => {
    const user = userEvent.setup();
    renderGame();

    await user.tab();
    expect(option("more")).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("img", { name: "plaža" }, { timeout: 2000 }),
    ).toBeInTheDocument();
    expect(option("plaža")).toHaveFocus();
  });

  it("has no axe violations with a word set aside", async () => {
    const { container } = renderGame();
    fireEvent.click(option("plaža"));

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations with the right word showing", async () => {
    const { container } = renderGame();
    fireEvent.click(option("more"));

    expect(await axe(container)).toHaveNoViolations();
  });
});
