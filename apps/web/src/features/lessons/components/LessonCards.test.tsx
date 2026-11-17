import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import type { LessonWord } from "../model/lesson";
import { LessonCards } from "./LessonCards";

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
    return {
      id: `word-${number}`,
      number,
      text,
      imageUrl:
        index < 8
          ? `/media/words/${String(number).padStart(4, "0")}.webp`
          : null,
    };
  });
}

function renderLesson() {
  const user = userEvent.setup();
  const view = render(<LessonCards words={makeWords()} />);
  return { user, ...view };
}

type User = ReturnType<typeof userEvent.setup>;

async function goToCard(user: User, card: number) {
  for (let step = 1; step < card; step += 1) {
    await user.click(nextButton());
  }
}

function nextButton() {
  return screen.getByRole("button", { name: "Dalje" });
}

function backButton() {
  return screen.getByRole("button", { name: "Nazad" });
}

function picture(name: string) {
  return screen.getByRole("img", { name });
}

function swipe(element: Element, fromX: number, toX: number) {
  fireEvent.touchStart(element, {
    touches: [{ clientX: fromX, clientY: 200 }],
  });
  fireEvent.touchMove(element, { touches: [{ clientX: toX, clientY: 200 }] });
  fireEvent.touchEnd(element, { touches: [] });
}

describe("LessonCards", () => {
  it("starts on the first picture, named by its word, card 1 of 10", () => {
    renderLesson();

    expect(picture("majica")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/ 1 od 10$/);
    expect(screen.getByRole("button", { name: "Slike" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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

  it("stays on the last card on Next, which says it does nothing there", async () => {
    const { user } = renderLesson();

    await goToCard(user, 10);
    expect(screen.getByRole("status")).toHaveTextContent(/ 10 od 10$/);
    expect(nextButton()).toHaveAttribute("aria-disabled", "true");
    expect(backButton()).toHaveAttribute("aria-disabled", "false");

    await user.click(nextButton());
    await user.keyboard("{ArrowRight}");
    await user.click(picture("marama"));

    expect(picture("marama")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/ 10 od 10$/);
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
    await user.click(screen.getByRole("button", { name: "Riječi" }));
    await goToCard(user, 3);

    const word = screen.getByText("šešir");
    expect(word.closest("[lang]")).toHaveAttribute("lang", "sr-Latn-ME");
    expect(screen.queryByText("Šešir")).not.toBeInTheDocument();
    // Neither a picture nor the placeholder art: both are named images.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("switches modes from the first card, as a real toggle", async () => {
    const { user } = renderLesson();
    const pictures = screen.getByRole("button", { name: "Slike" });
    const words = screen.getByRole("button", { name: "Riječi" });

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

    await user.click(screen.getByRole("button", { name: "Riječi" }));

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
    const { container } = render(<LessonCards words={[]} />);

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

  it("has no accessibility violations with words, on the last card", async () => {
    const { user, container } = renderLesson();

    await user.click(screen.getByRole("button", { name: "Riječi" }));
    await goToCard(user, 10);

    expect(await axe(container)).toHaveNoViolations();
  });
});
