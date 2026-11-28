import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import type { Word } from "../model/content";
import type { LearnedWords, WordsData } from "../model/words";
import { WordsScreen } from "./WordsScreen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

function word(number: number, text: string, note: string | null = null): Word {
  return {
    id: `word-${number}`,
    number,
    text,
    note,
    imageUrl: `/media/words/${String(number).padStart(4, "0")}.webp`,
    audioUrl: null,
  };
}

const LEARNED: LearnedWords = {
  places: [
    {
      id: "budva",
      name: "Budva",
      words: [
        word(1, "more"),
        word(2, "pijesak"),
        word(3, "zmaj", "igračka koja leti"),
      ],
    },
    { id: "tivat", name: "Tivat", words: [word(41, "palma")] },
  ],
  nextPlace: { name: "Kotor", wordCount: 4 },
  total: 4,
};

const TWO_PLACES: WordsData = {
  words: LEARNED,
  avatar: "owl",
  needsRetry: false,
};

const NO_WORDS: WordsData = {
  words: { places: [], nextPlace: { name: "Budva", wordCount: 20 }, total: 0 },
  avatar: "owl",
  needsRetry: false,
};

describe("WordsScreen", () => {
  it("shows Riječi as the current tab", () => {
    render(<WordsScreen {...TWO_PLACES} />);

    const nav = screen.getByRole("navigation", { name: "Glavni meni" });
    const words = within(nav).getByRole("link", { name: "Riječi" });
    expect(words).toHaveAttribute("href", "/play/words");
    expect(words).toHaveAttribute("aria-current", "page");
  });

  it("is headed Moje riječi, with every word counted in the badge", () => {
    render(<WordsScreen {...TWO_PLACES} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Moje riječi" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Riječi: 4" })).toHaveTextContent(
      "4",
    );
  });

  it("groups the words by place, each with its name, count and cards", () => {
    render(<WordsScreen {...TWO_PLACES} />);

    const budva = screen.getByRole("region", { name: "Budva" });
    expect(within(budva).getByText("· 3 riječi")).toBeInTheDocument();
    expect(
      within(budva)
        .getAllByRole("figure", { hidden: true })
        .map((card) => card.textContent),
    ).toEqual(["more", "pijesak", "zmaj, igračka koja leti"]);

    const tivat = screen.getByRole("region", { name: "Tivat" });
    expect(within(tivat).getByText("· 1 riječ")).toBeInTheDocument();
    expect(
      within(tivat).getByRole("figure", { name: "palma" }),
    ).toBeInTheDocument();
  });

  it("opens only the last place at first, and each place opens and closes", async () => {
    const user = userEvent.setup();
    render(<WordsScreen {...TWO_PLACES} />);

    const budva = screen.getByRole("region", { name: "Budva" });
    const budvaButton = within(budva).getByRole("button", { name: /Budva/ });
    expect(budvaButton).toHaveAttribute("aria-expanded", "false");
    expect(within(budva).queryByRole("figure")).not.toBeInTheDocument();

    const tivat = screen.getByRole("region", { name: "Tivat" });
    expect(
      within(tivat).getByRole("button", { name: /Tivat/ }),
    ).toHaveAttribute("aria-expanded", "true");

    await user.click(budvaButton);
    expect(budvaButton).toHaveAttribute("aria-expanded", "true");
    expect(within(budva).getAllByRole("figure")).toHaveLength(3);

    await user.click(budvaButton);
    expect(budvaButton).toHaveAttribute("aria-expanded", "false");
    expect(within(budva).queryByRole("figure")).not.toBeInTheDocument();
  });

  it("offers practice with every word: Memory, Spoji riječi and Sastavi riječi", () => {
    render(<WordsScreen {...TWO_PLACES} />);

    const practice = screen.getByRole("group", { name: "Vježbaj" });
    expect(
      within(practice).getByRole("link", { name: "Memory" }),
    ).toHaveAttribute("href", "/play/words/memory");
    expect(
      within(practice).getByRole("link", { name: "Spoji riječi" }),
    ).toHaveAttribute("href", "/play/words/match");
    expect(
      within(practice).getByRole("link", { name: "Sastavi riječi" }),
    ).toHaveAttribute("href", "/play/words/spell");
  });

  it("says where to collect more words", () => {
    render(<WordsScreen {...TWO_PLACES} />);

    expect(
      screen.getByText("Sljedeće mjesto: Kotor · još 4 riječi"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Sljedeće mjesto/ }),
    ).not.toBeInTheDocument();
  });

  it("has no hint when there is no next place", () => {
    render(
      <WordsScreen {...TWO_PLACES} words={{ ...LEARNED, nextPlace: null }} />,
    );

    expect(screen.queryByText(/Sljedeće mjesto/)).not.toBeInTheDocument();
  });

  it("shows the empty state, with the way to the map, before any lesson", () => {
    const { container } = render(<WordsScreen {...NO_WORDS} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Još nemaš riječi" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pogledaj prvu lekciju i riječi će stići ovdje."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Na mapu" })).toHaveAttribute(
      "href",
      "/play",
    );
    expect(
      container.querySelector('img[src*="avatar-owl"]'),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Vježbaj" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Sljedeće mjesto/)).not.toBeInTheDocument();
    // The bottom nav stays.
    expect(
      screen.getByRole("navigation", { name: "Glavni meni" }),
    ).toBeInTheDocument();
  });

  it("offers a retry, and neither words nor the empty state, when the words failed", () => {
    render(<WordsScreen words={null} avatar="owl" needsRetry />);

    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Još nemaš riječi")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: /Riječi:/ }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["with words", TWO_PLACES],
    ["empty", NO_WORDS],
  ])("has no accessibility violations, %s", async (_, data) => {
    const { container } = render(<WordsScreen {...data} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
