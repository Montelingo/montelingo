import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { LessonWord } from "../model/lesson";
import { LessonCards, SETTLE_DELAY_MS } from "./LessonCards";

// "Ljeto i odjeća" (words 61–70): real images for most, none for the last two,
// so the placeholder shows. "Šešir" checks that a word card lowercases.
const TEXTS = [
  "majica",
  "šorc",
  "haljina",
  "Šešir",
  "naočare",
  "sandale",
  "kupaći kostim",
  "peškir",
  "suknja",
  "marama",
];

function makeWords(): LessonWord[] {
  return TEXTS.map((text, index) => {
    const number = 61 + index;
    const file = `/media/words/${String(number).padStart(4, "0")}`;
    return {
      id: `word-${number}`,
      number,
      text,
      imageUrl: index < 8 ? `${file}.webp` : null,
      imageUrl512: index < 8 ? `${file}-512.webp` : null,
    };
  });
}

const PLACE_HREF = "/play/primorje/budva";

function renderLesson() {
  const user = userEvent.setup();
  const onFinished = vi.fn();
  const view = render(
    <LessonCards
      words={makeWords()}
      placeHref={PLACE_HREF}
      onFinished={onFinished}
    />,
  );
  return { user, onFinished, ...view };
}

type User = ReturnType<typeof userEvent.setup>;

/** Lets the screen on display settle, so its buttons take presses. */
function settle() {
  vi.setSystemTime(Date.now() + SETTLE_DELAY_MS);
}

/** Presses Next from card 1 until `card` is on screen. */
async function goToCard(user: User, card: number) {
  settle();
  const next = nextButton();
  for (let step = 1; step < card; step += 1) {
    await user.click(next);
  }
}

/** Presses Next from card 1 through the last card, to "Bravo!". */
async function finishLesson(user: User) {
  await goToCard(user, 11);
  settle();
}

function nextButton() {
  return screen.getByRole("button", { name: "Dalje" });
}

function backButton() {
  return screen.getByRole("button", { name: "Nazad" });
}

function modeButton(name: "Slike" | "Riječi") {
  return screen.getByRole("button", { name });
}

function watchAgainButton() {
  return screen.getByRole("button", { name: "Pogledaj ponovo" });
}

function picture(name: string) {
  return screen.getByRole("img", { name });
}

function dots(): Element[] {
  return Array.from(screen.getByTestId("lesson-dots").children);
}

/** The current dot, from 1. */
function currentDot(): number {
  return (
    dots().findIndex((dot) => dot.getAttribute("data-current") === "true") + 1
  );
}

function bravo() {
  return screen.queryByRole("heading", { name: "Bravo!" });
}

function swipe(element: Element, fromX: number, toX: number) {
  fireEvent.touchStart(element, {
    touches: [{ clientX: fromX, clientY: 200 }],
  });
  fireEvent.touchMove(element, { touches: [{ clientX: toX, clientY: 200 }] });
  fireEvent.touchEnd(element, { touches: [] });
}

describe("LessonCards", () => {
  // Only the clock: the screens wait SETTLE_DELAY_MS before taking presses.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts on the first picture, named by its word, card 1 of 10", () => {
    renderLesson();

    expect(picture("majica")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/ 1 od 10$/);
    expect(modeButton("Slike")).toHaveAttribute("aria-pressed", "true");
  });

  it("moves forward and back with the buttons", async () => {
    const { user } = renderLesson();

    await user.click(nextButton());
    await user.click(nextButton());
    expect(picture("haljina")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/ 3 od 10$/);

    await user.click(backButton());
    expect(picture("šorc")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/ 2 od 10$/);
  });

  it("moves forward on a tap of the card", async () => {
    const { user } = renderLesson();

    await user.click(picture("majica"));

    expect(picture("šorc")).toBeInTheDocument();
  });

  it("moves forward on a swipe left, and back on a swipe right", () => {
    renderLesson();

    swipe(picture("majica"), 400, 100);
    expect(picture("šorc")).toBeInTheDocument();

    swipe(picture("šorc"), 100, 400);
    expect(picture("majica")).toBeInTheDocument();
  });

  it("moves with the arrow keys", async () => {
    const { user } = renderLesson();

    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(picture("haljina")).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(picture("šorc")).toBeInTheDocument();
  });

  it("stays on the first card on Back, which says it does nothing there", async () => {
    const { user } = renderLesson();

    expect(backButton()).toHaveAttribute("aria-disabled", "true");
    expect(nextButton()).toHaveAttribute("aria-disabled", "false");

    await user.click(backButton());
    await user.keyboard("{ArrowLeft}");

    expect(picture("majica")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/ 1 od 10$/);
  });

  it("keeps Next working on the last card, where it ends the lesson", async () => {
    const { user, onFinished } = renderLesson();

    await goToCard(user, 10);
    expect(screen.getByRole("status")).toHaveTextContent(/ 10 od 10$/);
    expect(nextButton()).toHaveAttribute("aria-disabled", "false");
    expect(backButton()).toHaveAttribute("aria-disabled", "false");
    expect(bravo()).not.toBeInTheDocument();
    expect(onFinished).toHaveBeenCalledTimes(1);

    await user.click(nextButton());

    expect(bravo()).toBeInTheDocument();
  });

  it("shows a row of ten dots, hidden from screen readers, that follows the card", async () => {
    const { user } = renderLesson();

    // Screen readers hear "1 od 10" in the status line instead.
    expect(screen.getByTestId("lesson-dots")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(dots()).toHaveLength(10);
    expect(
      dots().filter((dot) => dot.getAttribute("data-current") === "true"),
    ).toHaveLength(1);
    expect(currentDot()).toBe(1);

    await user.click(nextButton());
    await user.click(nextButton());
    expect(currentDot()).toBe(3);

    await user.keyboard("{ArrowLeft}");
    expect(currentDot()).toBe(2);

    await user.click(modeButton("Riječi"));
    expect(currentDot()).toBe(1);

    await goToCard(user, 10);
    expect(currentDot()).toBe(10);
  });

  it("marks only the current dot, not the cards before it", async () => {
    const { user } = renderLesson();

    // The switch on card 1 starts from card 2: card 1's word was never shown.
    await user.click(modeButton("Riječi"));

    expect(currentDot()).toBe(2);
    expect(dots()[0]).toHaveAttribute("data-current", "false");
  });

  it("tells the grown-up to read each word aloud", () => {
    renderLesson();

    expect(
      screen.getByText("Pročitajte djetetu svaku riječ naglas."),
    ).toBeInTheDocument();
  });

  it("ends with Bravo!, a way to watch again and a way back to the place", async () => {
    const { user } = renderLesson();

    await finishLesson(user);

    expect(bravo()).toHaveFocus();
    expect(watchAgainButton()).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Nazad na mjesto" }),
    ).toHaveAttribute("href", PLACE_HREF);
    // The lesson itself is gone: no card, switch, dots or arrows.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lesson-dots")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dalje" }),
    ).not.toBeInTheDocument();
    expect(bravo()?.closest("[lang]")).toHaveAttribute("lang", "sr-Latn-ME");
  });

  it("calls onFinished once on reaching the last card, and not again on Bravo! or a second watch", async () => {
    const { user, onFinished } = renderLesson();

    await goToCard(user, 9);
    expect(onFinished).not.toHaveBeenCalled();

    await user.click(nextButton());
    expect(screen.getByRole("status")).toHaveTextContent(/ 10 od 10$/);
    expect(onFinished).toHaveBeenCalledTimes(1);

    // Back and on to the last card again, then Bravo!.
    await user.click(backButton());
    await user.click(nextButton());
    await user.click(nextButton());
    expect(bravo()).toBeInTheDocument();
    expect(onFinished).toHaveBeenCalledTimes(1);

    // The arrow keys do nothing on the Bravo! screen.
    await user.keyboard("{ArrowRight}{ArrowLeft}");
    expect(bravo()).toBeInTheDocument();

    settle();
    await user.click(watchAgainButton());
    await finishLesson(user);

    expect(bravo()).toBeInTheDocument();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("does not call onFinished again when it changes on the Bravo! screen", async () => {
    const { user, onFinished, rerender } = renderLesson();
    await finishLesson(user);
    const later = vi.fn();

    rerender(
      <LessonCards
        words={makeWords()}
        placeHref={PLACE_HREF}
        onFinished={later}
      />,
    );

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(later).not.toHaveBeenCalled();
  });

  it("ignores the Bravo! buttons for a moment, so the tap after the last card presses neither", async () => {
    const { user } = renderLesson();

    await goToCard(user, 10);
    await user.click(nextButton());
    await user.click(watchAgainButton());
    const link = screen.getByRole("link", { name: "Nazad na mjesto" });

    expect(bravo()).toBeInTheDocument();
    // fireEvent.click is false when the click's default (following the link)
    // was prevented.
    expect(fireEvent.click(link)).toBe(false);

    settle();
    await user.click(watchAgainButton());

    expect(picture("majica")).toBeInTheDocument();
  });

  it("turns one card on a held Enter on Next, however long it is held", async () => {
    const { user } = renderLesson();
    nextButton().focus();

    // Held: one press, then the key's repeats.
    await user.keyboard("{Enter>5/}");
    expect(screen.getByRole("status")).toHaveTextContent(/ 2 od 10$/);

    settle();
    settle();
    await user.keyboard("{Enter>5/}");
    expect(screen.getByRole("status")).toHaveTextContent(/ 3 od 10$/);
  });

  it("does not let a held Enter on Watch again skip cards", async () => {
    const { user } = renderLesson();

    await finishLesson(user);
    watchAgainButton().focus();
    // The key's repeats land on Next, which now has the focus.
    await user.keyboard("{Enter>5/}");

    expect(nextButton()).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(/ 1 od 10$/);
  });

  it("does not call onFinished again on a switch after the last card was reached", async () => {
    const { user, onFinished } = renderLesson();

    await goToCard(user, 10);
    await user.click(modeButton("Riječi"));
    await goToCard(user, 10);

    expect(screen.getByText("marama")).toBeInTheDocument();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("calls onFinished again on a new visit, as recording a lesson twice is harmless", async () => {
    const { user, onFinished, unmount } = renderLesson();
    await goToCard(user, 10);
    unmount();

    // ADR 0006: recording is idempotent, so each visit reports.
    const again = renderLesson();
    await goToCard(again.user, 10);

    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(again.onFinished).toHaveBeenCalledTimes(1);
  });

  it("calls onFinished on reaching the last card in Riječi too", async () => {
    const { user, onFinished } = renderLesson();

    // The switch on card 1 starts from card 2: eight more reach card 10.
    await user.click(modeButton("Riječi"));
    await goToCard(user, 9);

    expect(screen.getByText("marama")).toBeInTheDocument();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("calls onFinished on mount for a one-word lesson, whose first card is its last", () => {
    const onFinished = vi.fn();
    render(
      <LessonCards
        words={makeWords().slice(0, 1)}
        placeHref={PLACE_HREF}
        onFinished={onFinished}
      />,
    );

    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("calls onFinished passed in only after Bravo! showed", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <LessonCards words={makeWords()} placeHref={PLACE_HREF} />,
    );
    await finishLesson(user);
    const onFinished = vi.fn();

    rerender(
      <LessonCards
        words={makeWords()}
        placeHref={PLACE_HREF}
        onFinished={onFinished}
      />,
    );

    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("watches again from the first card, in the same mode, with the focus on Next", async () => {
    const { user } = renderLesson();

    // The switch on card 1 starts from card 2: nine more reach Bravo!.
    await user.click(modeButton("Riječi"));
    await goToCard(user, 10);
    expect(bravo()).toBeInTheDocument();
    settle();
    await user.click(watchAgainButton());

    expect(screen.getByText("majica")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("majica, 1 od 10");
    expect(modeButton("Riječi")).toHaveAttribute("aria-pressed", "true");
    expect(currentDot()).toBe(1);
    expect(nextButton()).toHaveFocus();
  });

  it("works without onFinished", async () => {
    const user = userEvent.setup();
    render(<LessonCards words={makeWords()} placeHref={PLACE_HREF} />);

    await finishLesson(user);

    expect(bravo()).toBeInTheDocument();
  });

  it("shows no writing on a picture card", () => {
    renderLesson();

    const card = picture("majica");
    expect(card).toHaveTextContent(/^$/);
    expect(screen.queryByText("majica")).not.toBeInTheDocument();
    expect(card.querySelector("img")).toHaveAttribute(
      "src",
      "/media/words/0061.webp",
    );
  });

  it("fetches the first card's picture first, and offers both files to every card", async () => {
    const { user } = renderLesson();

    const first = picture("majica").querySelector("img");
    expect(first).toHaveAttribute("fetchpriority", "high");
    expect(first).not.toHaveAttribute("loading");
    expect(first).toHaveAttribute(
      "srcset",
      "/media/words/0061-512.webp 512w, /media/words/0061.webp 1024w",
    );

    await goToCard(user, 2);

    const second = screen
      .getByRole("img", { name: TEXTS[1] })
      .querySelector("img");
    expect(second).not.toHaveAttribute("fetchpriority");
    expect(second).toHaveAttribute(
      "srcset",
      "/media/words/0062-512.webp 512w, /media/words/0062.webp 1024w",
    );
  });

  it("shows the placeholder art, without a letter, for a word with no picture", async () => {
    const { user } = renderLesson();

    await goToCard(user, 9);

    const card = picture("suknja");
    expect(card.querySelector("img")).toBeNull();
    expect(card.querySelector("svg")).not.toBeNull();
    expect(card).toHaveTextContent(/^$/);
  });

  it("shows the word alone, in lowercase and the content's language, in Riječi", async () => {
    const { user } = renderLesson();

    // The switch on card 1 starts from card 2; two more reach "Šešir".
    await user.click(modeButton("Riječi"));
    await goToCard(user, 3);

    const word = screen.getByText("šešir");
    expect(word.closest("[lang]")).toHaveAttribute("lang", "sr-Latn-ME");
    expect(screen.queryByText("Šešir")).not.toBeInTheDocument();
    // Neither a picture nor the placeholder art: both are named images.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("switches modes from the first card, as a real toggle", async () => {
    const { user } = renderLesson();
    const pictures = modeButton("Slike");
    const words = modeButton("Riječi");

    await user.click(nextButton());
    await user.click(nextButton());
    await user.click(words);

    expect(words).toHaveAttribute("aria-pressed", "true");
    expect(pictures).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("majica")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/ 1 od 10$/);

    await user.click(nextButton());
    await user.click(pictures);

    expect(picture("majica")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/ 1 od 10$/);
  });

  it("starts from card 2 when the switch is pressed on card 1, so a word never follows its picture", async () => {
    const { user } = renderLesson();

    await user.click(modeButton("Riječi"));

    expect(screen.queryByText("majica")).not.toBeInTheDocument();
    expect(screen.getByText("šorc")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/ 2 od 10$/);
  });

  it("announces the word and its place when the card changes", async () => {
    const { user } = renderLesson();

    await user.click(nextButton());

    expect(screen.getByRole("status")).toHaveTextContent("šorc, 2 od 10");
  });

  it("moves back on a mouse drag to the right, without the click counting as Next", async () => {
    const { user } = renderLesson();
    await user.click(nextButton());
    const card = picture("šorc");

    fireEvent.mouseDown(card, { clientX: 100, clientY: 200 });
    fireEvent.mouseMove(document, { clientX: 400, clientY: 200 });
    fireEvent.mouseUp(document, { clientX: 400, clientY: 200 });
    fireEvent.click(card);

    expect(picture("majica")).toBeInTheDocument();
  });

  it("renders nothing and leaves the arrow keys alone with no words", () => {
    const { container } = render(
      <LessonCards words={[]} placeHref={PLACE_HREF} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(fireEvent.keyDown(document, { key: "ArrowRight" })).toBe(true);
  });

  it("names the switch's group", () => {
    renderLesson();

    const group = screen.getByRole("group", { name: "Prikaz" });
    expect(within(group).getAllByRole("button")).toHaveLength(2);
  });

  it("has no accessibility violations with pictures", async () => {
    const { container } = renderLesson();

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations on the Bravo! screen", async () => {
    const { user, container } = renderLesson();

    await finishLesson(user);

    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with words, on the last card", async () => {
    const { user, container } = renderLesson();

    await user.click(modeButton("Riječi"));
    await goToCard(user, 10);

    expect(await axe(container)).toHaveNoViolations();
  });
});
