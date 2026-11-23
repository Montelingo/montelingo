import {
  CheckCircleIcon,
  LockClosedIcon,
  PlayIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import {
  type ChapterState,
  type GameState,
  joinChapterStates,
} from "../model/progress";
import {
  makeChapterState,
  NO_COUNTS,
  seedLocationDetail,
} from "../test-fixtures";
import { GamesArea } from "./GamesArea";

// Podgorica: four chapters, the first "Kod kuće" (podgorica-home).
const podgorica = seedLocationDetail("podgorica");
const HOME = "podgorica-home";

// The area for one of Podgorica's chapters, with the states progress sent.
function renderArea(states: readonly ChapterState[], chapterId = HOME) {
  const chapter = joinChapterStates(podgorica.chapters, {
    status: "ready",
    progress: {
      regions: [],
      locations: [],
      chapters: states,
      counts: NO_COUNTS,
    },
  }).find(({ id }) => id === chapterId);
  if (chapter === undefined) {
    throw new Error(`No chapter ${chapterId}`);
  }
  return render(<GamesArea location={podgorica} chapter={chapter} />);
}

// "Kod kuće" with both games in `state`, and the lesson as the server would
// send it: done once the games have opened.
function renderHomeWithGames(state: GameState) {
  return renderArea([
    makeChapterState(HOME, {
      lesson: state === "locked" ? "todo" : "done",
      memory: state,
      match: state,
    }),
  ]);
}

// The cards of the chapter titled `title`: its lesson, then its games.
function cardsOf(title: string) {
  return within(
    screen.getByRole("list", { name: `${title} lesson and games` }),
  ).getAllByRole("listitem");
}

// The card's text is "<title>, <state>".
function titleOf(item: HTMLElement): string {
  return item.textContent?.split(",")[0] ?? "";
}

// The item's link, or `null` when its card is plain text.
function linkOf(item: HTMLElement): HTMLElement | null {
  return within(item).queryByRole("link");
}

function card(chapterTitle: string, cardTitle: string): HTMLElement {
  const found = cardsOf(chapterTitle).find(
    (item) => titleOf(item) === cardTitle,
  );
  if (found === undefined) {
    throw new Error(`No ${cardTitle} card in ${chapterTitle}`);
  }
  return found;
}

// Whether the card draws `Icon`, by the icon's path.
function hasIcon(item: HTMLElement, Icon: typeof StarIcon): boolean {
  const expected = /\sd="([^"]+)"/.exec(renderToStaticMarkup(<Icon />))?.[1];
  return Array.from(item.querySelectorAll("svg path")).some(
    (path) => path.getAttribute("d") === expected,
  );
}

describe("GamesArea", () => {
  it("gives the chapter, and only it, a Lesson card then a card per game", () => {
    renderArea(podgorica.chapters.map(({ id }) => makeChapterState(id)));

    expect(screen.getAllByRole("list")).toHaveLength(1);
    expect(cardsOf("Kod kuće").map(titleOf)).toEqual([
      "Lesson",
      "Memory",
      "Match",
    ]);
  });

  it("is a region named Games, in the page's English", () => {
    renderArea([makeChapterState(HOME)]);

    const games = screen.getByRole("region", { name: "Games" });
    expect(games.closest("[lang]")).toBeNull();
    expect(games.querySelector("[lang]")).toBeNull();
  });

  describe("a game's card follows the server's state", () => {
    it("locked: the lock icon and 'first watch the lesson'", () => {
      renderHomeWithGames("locked");

      const item = card("Kod kuće", "Memory");
      expect(item).toHaveTextContent("Memory, First watch the lesson");
      expect(hasIcon(item, LockClosedIcon)).toBe(true);
    });

    it("available: ready to play, with no lock", () => {
      renderHomeWithGames("available");

      const item = card("Kod kuće", "Memory");
      expect(item).toHaveTextContent("Memory, Ready to play");
      expect(hasIcon(item, PlayIcon)).toBe(true);
    });

    it("completed: a star", () => {
      renderHomeWithGames("completed");

      const item = card("Kod kuće", "Memory");
      expect(item).toHaveTextContent("Memory, Completed");
      expect(hasIcon(item, StarIcon)).toBe(true);
    });

    it("draws each game in its own state, never derived from the lesson", () => {
      // A combination the server would not send today: the area still draws
      // exactly what it was given, rather than deciding a lock itself.
      renderArea([
        makeChapterState(HOME, { lesson: "todo", memory: "completed" }),
      ]);

      expect(hasIcon(card("Kod kuće", "Memory"), StarIcon)).toBe(true);
    });

    it.each<[GameState, string]>([
      ["locked", "First watch the lesson"],
      ["available", "Ready to play"],
      ["completed", "Completed"],
    ])("draws Match in its own state too (%s)", (state, label) => {
      renderHomeWithGames(state);

      expect(card("Kod kuće", "Match")).toHaveTextContent(`Match, ${label}`);
    });

    it("lists the games in the server's order", () => {
      renderArea([
        {
          id: HOME,
          lesson: "done",
          games: [
            { id: "match", state: "available" },
            { id: "memory", state: "completed" },
          ],
        },
      ]);

      expect(cardsOf("Kod kuće").map(titleOf)).toEqual([
        "Lesson",
        "Match",
        "Memory",
      ]);
    });
  });

  describe("the Lesson card", () => {
    it("has no done mark before the lesson is seen", () => {
      renderHomeWithGames("locked");

      const lesson = card("Kod kuće", "Lesson");
      expect(lesson).toHaveTextContent("Lesson, Start here");
      expect(hasIcon(lesson, CheckCircleIcon)).toBe(false);
    });

    it("has a done mark once the lesson is seen", () => {
      renderHomeWithGames("available");

      const lesson = card("Kod kuće", "Lesson");
      expect(lesson).toHaveTextContent("Lesson, Done");
      expect(hasIcon(lesson, CheckCircleIcon)).toBe(true);
    });
  });

  it("still opens the lesson of a chapter progress has no state for, and says its games did not load, with nothing that looks locked or open", () => {
    // Only "Kod kuće" has a state.
    renderArea([makeChapterState(HOME)], "podgorica-vegetables");

    const items = cardsOf("Povrće i ručak");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Lesson, Watch");
    expect(linkOf(items[0] as HTMLElement)).toHaveAttribute(
      "href",
      "/play/central/podgorica/podgorica-vegetables/lesson",
    );
    expect(screen.getByText("Its games did not load.")).toBeInTheDocument();
  });

  describe("links", () => {
    it("links the lesson, whatever its state, and no locked game", () => {
      renderHomeWithGames("locked");

      expect(linkOf(card("Kod kuće", "Lesson"))).toHaveAttribute(
        "href",
        "/play/central/podgorica/podgorica-home/lesson",
      );
      // Name computations differ on the space around the comma.
      expect(linkOf(card("Kod kuće", "Lesson"))).toHaveAccessibleName(
        /^Lesson\s*,\s*Start here$/,
      );
      expect(linkOf(card("Kod kuće", "Memory"))).toBeNull();
      expect(linkOf(card("Kod kuće", "Match"))).toBeNull();
    });

    it.each<GameState>(["available", "completed"])(
      "links a game the server has opened (%s) to its screen",
      (state) => {
        renderHomeWithGames(state);

        expect(linkOf(card("Kod kuće", "Memory"))).toHaveAttribute(
          "href",
          "/play/central/podgorica/podgorica-home/memory",
        );
        expect(linkOf(card("Kod kuće", "Match"))).toHaveAttribute(
          "href",
          "/play/central/podgorica/podgorica-home/match",
        );
        expect(linkOf(card("Kod kuće", "Lesson"))).toHaveAttribute(
          "href",
          "/play/central/podgorica/podgorica-home/lesson",
        );
      },
    );
  });

  it.each<GameState>(["locked", "available", "completed"])(
    "has links only, nothing else to press, and no accessibility violations, when the games are %s",
    async (state) => {
      const { container } = renderHomeWithGames(state);

      const games = screen.getByRole("region", { name: "Games" });
      expect(within(games).queryByRole("button")).not.toBeInTheDocument();
      expect(games.querySelector("[tabindex]")).toBeNull();
      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
