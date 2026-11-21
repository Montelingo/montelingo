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
import { makeChapterState, seedLocationDetail } from "../test-fixtures";
import { GamesArea } from "./GamesArea";

// Podgorica: four chapters, the first "Kod kuće" (podgorica-home).
const podgorica = seedLocationDetail("podgorica");
const HOME = "podgorica-home";

// The area for Podgorica, with the chapter states progress sent.
function renderArea(states: readonly ChapterState[]) {
  return render(
    <GamesArea
      location={podgorica}
      chapters={joinChapterStates(podgorica.chapters, {
        status: "ready",
        progress: { regions: [], locations: [], chapters: states },
      })}
    />,
  );
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

// The pills of the chapter titled `title`: its lesson, then its games.
function cardsOf(title: string) {
  return within(
    screen.getByRole("list", { name: `${title} lesson and games` }),
  ).getAllByRole("listitem");
}

// The pill is the item's one child, a link or plain text: its icon, then its
// title.
function titleOf(item: HTMLElement): string {
  return item.querySelector(":scope > * > span")?.textContent ?? "";
}

// The item's link, or `null` when its pill is plain text.
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

// Whether the card's badge draws `Icon`, by the icon's path.
function hasIcon(item: HTMLElement, Icon: typeof StarIcon): boolean {
  const expected = /\sd="([^"]+)"/.exec(renderToStaticMarkup(<Icon />))?.[1];
  return item.querySelector("svg path")?.getAttribute("d") === expected;
}

describe("GamesArea", () => {
  it("gives each chapter, in recording order, a Lesson card then a card per game", () => {
    renderArea(podgorica.chapters.map(({ id }) => makeChapterState(id)));

    const games = screen.getByRole("region", { name: "Games" });
    expect(
      within(games)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Kod kuće", "Povrće i ručak", "U kuhinji", "U vrtiću"]);
    for (const { title } of podgorica.chapters) {
      expect(cardsOf(title).map(titleOf)).toEqual([
        "Lesson",
        "Memory",
        "Match",
      ]);
    }
  });

  it("marks a chapter's title as Montenegrin, and the English around it as not", () => {
    renderArea([makeChapterState(HOME)]);

    expect(
      screen.getByRole("heading", { level: 3, name: "Kod kuće" }),
    ).toHaveAttribute("lang", "sr-Latn-ME");
    expect(card("Kod kuće", "Lesson").closest("[lang]")).toBeNull();
  });

  describe("a game's card follows the server's state", () => {
    it("locked: the lock icon and 'first watch the lesson'", () => {
      renderHomeWithGames("locked");

      for (const game of ["Memory", "Match"]) {
        const item = card("Kod kuće", game);
        expect(item).toHaveTextContent(`${game}, First watch the lesson`);
        expect(hasIcon(item, LockClosedIcon)).toBe(true);
      }
    });

    it("available: ready to play, with no lock", () => {
      renderHomeWithGames("available");

      for (const game of ["Memory", "Match"]) {
        const item = card("Kod kuće", game);
        expect(item).toHaveTextContent(`${game}, Ready to play`);
        expect(hasIcon(item, PlayIcon)).toBe(true);
      }
    });

    it("completed: a star", () => {
      renderHomeWithGames("completed");

      for (const game of ["Memory", "Match"]) {
        const item = card("Kod kuće", game);
        expect(item).toHaveTextContent(`${game}, Completed`);
        expect(hasIcon(item, StarIcon)).toBe(true);
      }
    });

    it("draws each game in its own state, never derived from the lesson", () => {
      // A combination the server would not send today: the area still draws
      // exactly what it was given, rather than deciding a lock itself.
      renderArea([
        makeChapterState(HOME, {
          lesson: "todo",
          memory: "completed",
          match: "available",
        }),
      ]);

      expect(hasIcon(card("Kod kuće", "Memory"), StarIcon)).toBe(true);
      expect(hasIcon(card("Kod kuće", "Match"), PlayIcon)).toBe(true);
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

  it("says a chapter progress has no state for did not load, with no card that looks locked or open", () => {
    renderArea([makeChapterState(HOME)]);

    // Only "Kod kuće" has a state.
    expect(
      screen.queryByRole("list", { name: "Povrće i ručak lesson and games" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText("This chapter's lesson and games did not load."),
    ).toHaveLength(3);
    expect(cardsOf("Kod kuće")).toHaveLength(3);
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
        expect(linkOf(card("Kod kuće", "Lesson"))).toHaveAttribute(
          "href",
          "/play/central/podgorica/podgorica-home/lesson",
        );
      },
    );

    it("does not link a game that has no screen yet, even when open", () => {
      renderHomeWithGames("available");

      // Match gets its screen with #137.
      expect(linkOf(card("Kod kuće", "Match"))).toBeNull();
    });
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
