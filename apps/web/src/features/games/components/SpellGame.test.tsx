import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { SETTLE_DELAY_MS } from "@/lib/use-settled";

import { spellLetters, type SpellWord } from "../model/spell";
import { SOLVED_DELAY_MS, SpellGame, type SpellGameProps } from "./SpellGame";

// Six learned words: a game plays five, and "galeb", the sixth, is left out.
const TEXTS = ["more", "rak", "Konj", "riba", "sunce", "galeb"];

function makeWords(): SpellWord[] {
  return TEXTS.map((text, index) => ({
    id: `word-${index + 1}`,
    text,
    imageUrl: `/media/words/${String(index + 1).padStart(4, "0")}.webp`,
  }));
}

// Fisher–Yates swaps item i with item ⌊random · (i + 1)⌋: just under 1 keeps
// every item where it is. The game then takes the first five words and plays
// them shortest first: rak, konj, more, riba, sunce. Tiles left in order are
// turned by one, so "rak"'s tiles are a, k, r.
const NO_SHUFFLE = () => 0.999;
const ORDER = ["rak", "Konj", "more", "riba", "sunce"];

const WORDS_HREF = "/play/words";
const BACK_LABEL = "Nazad na riječi";

function renderGame(props: Partial<SpellGameProps> = {}) {
  return render(
    <SpellGame
      words={makeWords()}
      placeHref={WORDS_HREF}
      backLabel={BACK_LABEL}
      random={NO_SHUFFLE}
      {...props}
    />,
  );
}

function game() {
  return screen.getByRole("group", { name: "Sastavi riječ za sliku" });
}

function picture() {
  return within(game()).getByRole("img");
}

function tiles() {
  return within(game()).getAllByRole("button");
}

/** The first tile with `letter` that still takes a tap. */
function tile(letter: string) {
  const found = within(game())
    .getAllByRole("button", { name: letter })
    .find((button) => button.getAttribute("aria-disabled") === "false");
  if (found === undefined) {
    throw new Error(`no open tile ${letter}`);
  }
  return found;
}

function slots() {
  return Array.from(screen.getByTestId("spell-slots").children);
}

function steps() {
  return screen.getByTestId("spell-steps").children;
}

function status() {
  return screen.getByRole("status");
}

function bravo() {
  return screen.queryByRole("heading", { name: /^Bravo/ });
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Tap the word's letters in order, then wait for the next word. */
function spellWord(text: string) {
  for (const letter of spellLetters(text.toLowerCase())) {
    fireEvent.click(tile(letter));
  }
  wait(SOLVED_DELAY_MS);
}

/** Every word spelled, and "Bravo!" settled. */
function playToBravo() {
  for (const text of ORDER) {
    spellWord(text);
  }
  wait(SETTLE_DELAY_MS);
}

describe("SpellGame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the shortest word's picture, an empty slot per letter, and its letters as tiles", () => {
    renderGame();

    expect(picture()).toHaveAccessibleName("rak");
    expect(picture().querySelector("img")).toHaveAttribute(
      "src",
      "/media/words/0002.webp",
    );
    expect(slots()).toHaveLength(3);
    expect(slots().map((slot) => slot.textContent)).toEqual(["", "", ""]);
    expect(tiles().map((button) => button.textContent)).toEqual([
      "a",
      "k",
      "r",
    ]);
    expect(game()).toHaveAttribute("lang", "sr-Latn-ME");
    expect(status()).toHaveTextContent("Riječ 1 od 5");
  });

  it("fills the next slot with a right tile, and keeps the tile in place, faded", () => {
    renderGame();

    fireEvent.click(tile("r"));

    expect(slots().map((slot) => slot.textContent)).toEqual(["r", "", ""]);
    const placed = within(game()).getByRole("button", { name: "r" });
    expect(placed).toHaveAttribute("aria-disabled", "true");
    expect(placed).toHaveClass("opacity-30");
    expect(status()).toHaveTextContent("r");
  });

  it("shakes a wrong tile back, fills nothing, and lets it be tapped again", () => {
    renderGame();

    const k = tile("k");
    fireEvent.click(k);

    expect(slots().map((slot) => slot.textContent)).toEqual(["", "", ""]);
    expect(k).toHaveAttribute("aria-disabled", "false");
    expect(k).toHaveClass("border-kid-red");
    const letter = k.firstElementChild;
    expect(letter).toHaveClass("motion-safe:animate-wiggle");
    expect(status()).toHaveTextContent("Pokušaj ponovo.");

    // A second bounce plays the shake again, on the same button.
    fireEvent.click(k);
    expect(k.firstElementChild).not.toBe(letter);
    expect(tile("k")).toBe(k);

    // A right tile clears it.
    fireEvent.click(tile("r"));
    expect(k).not.toHaveClass("border-kid-red");
  });

  it("takes no tap on a placed tile", () => {
    renderGame();
    fireEvent.click(tile("r"));

    fireEvent.click(within(game()).getByRole("button", { name: "r" }));

    expect(slots().map((slot) => slot.textContent)).toEqual(["r", "", ""]);
    expect(status()).toHaveTextContent("r");
  });

  it("shows the spelled word a moment, then the next one", () => {
    renderGame();

    fireEvent.click(tile("r"));
    fireEvent.click(tile("a"));
    fireEvent.click(tile("k"));

    expect(status()).toHaveTextContent("Tačno! rak");
    expect(
      slots().every((slot) => slot.classList.contains("bg-kid-green")),
    ).toBe(true);
    expect(tiles().every((button) => button.ariaDisabled === "true")).toBe(
      true,
    );

    wait(SOLVED_DELAY_MS - 1);
    expect(picture()).toHaveAccessibleName("rak");
    wait(1);
    expect(picture()).toHaveAccessibleName("Konj");
  });

  it("gives lj, nj and dž one tile and one slot each", () => {
    renderGame();
    spellWord("rak");

    expect(slots()).toHaveLength(3);
    expect(
      tiles()
        .map((button) => button.textContent)
        .sort(),
    ).toEqual(["k", "nj", "o"]);
  });

  it("shows a step per word: the done ones, then the current one", () => {
    renderGame();
    expect(steps()).toHaveLength(5);

    spellWord("rak");
    spellWord("konj");

    expect(steps()[0]).toHaveAttribute("data-done", "true");
    expect(steps()[1]).toHaveAttribute("data-done", "true");
    expect(steps()[2]).toHaveAttribute("data-current", "true");
    expect(steps()[3]).toHaveAttribute("data-done", "false");
    expect(status()).toHaveTextContent("Riječ 3 od 5");
  });

  it("shows Bravo! after the fifth word, with the focus on it, and leads back to Riječi", () => {
    renderGame({ learnerName: "Mia" });

    for (const text of ORDER.slice(0, -1)) {
      spellWord(text);
    }
    expect(bravo()).not.toBeInTheDocument();
    spellWord("sunce");

    expect(bravo()).toHaveTextContent("Bravo, Mia!");
    expect(bravo()).toHaveFocus();
    expect(screen.getByText("Sve riječi su složene!")).toBeVisible();
    expect(screen.getByRole("link", { name: BACK_LABEL })).toHaveAttribute(
      "href",
      WORDS_HREF,
    );
  });

  it("calls onCompleted for every game played to the end, Igraj ponovo's too", () => {
    const onCompleted = vi.fn();
    renderGame({ onCompleted });

    playToBravo();
    expect(onCompleted).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Igraj ponovo" }));
    expect(bravo()).not.toBeInTheDocument();
    expect(picture()).toHaveAccessibleName("rak");
    expect(tiles()[0]).toHaveFocus();

    playToBravo();
    expect(onCompleted).toHaveBeenCalledTimes(2);
  });

  it("plays fewer words when fewer can be spelled", () => {
    const onCompleted = vi.fn();
    renderGame({ words: makeWords().slice(0, 2), onCompleted });

    expect(steps()).toHaveLength(2);
    spellWord("rak");
    spellWord("more");

    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("shows nothing for words that deal no game", () => {
    const { container } = renderGame({
      words: [{ id: "w", text: "morski konjić", imageUrl: "/w.webp" }],
    });

    expect(container).toBeEmptyDOMElement();
  });
});

// The deal is random, so the server renders no round: two deals would not
// hydrate.
describe("SpellGame on the server", () => {
  it("renders no round", () => {
    const html = renderToString(
      <SpellGame
        words={makeWords()}
        placeHref={WORDS_HREF}
        backLabel={BACK_LABEL}
      />,
    );

    expect(html).toBe("");
  });
});

// Real timers: user-event and axe wait on them.
describe("SpellGame with the keyboard and axe", () => {
  it("plays with the keyboard, and keeps the focus on the tiles between words", async () => {
    const user = userEvent.setup();
    renderGame();

    // a, k, r: r is third.
    await user.tab();
    await user.tab();
    await user.tab();
    expect(tile("r")).toHaveFocus();
    await user.keyboard("{Enter}");
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    await user.keyboard("{Enter}");
    await user.tab();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("img", { name: "Konj" }, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(tiles()[0]).toHaveFocus();
  });

  it("has no axe violations with a tile bounced", async () => {
    const { container } = renderGame();
    fireEvent.click(tile("k"));

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations with the word spelled", async () => {
    const { container } = renderGame();
    fireEvent.click(tile("r"));
    fireEvent.click(tile("a"));
    fireEvent.click(tile("k"));

    expect(await axe(container)).toHaveNoViolations();
  });
});
