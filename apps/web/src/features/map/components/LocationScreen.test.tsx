import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import type { LocationDetail } from "../model/content";
import type { ChapterState } from "../model/progress";
import { type LocationScreenData, toLocationScreen } from "../model/screens";
import {
  makeChapterState,
  NO_COUNTS,
  seedLocationDetail,
  seedRegionDetail,
} from "../test-fixtures";
import { LocationScreen } from "./LocationScreen";

// A place the server has opened, in its open region, as the gate returns it:
// by default its chapters not started yet.
function openPlace(
  regionId: Parameters<typeof seedRegionDetail>[0],
  location: LocationDetail,
  chapters: readonly ChapterState[] = location.chapters.map(({ id }) =>
    makeChapterState(id),
  ),
): LocationScreenData {
  return toLocationScreen(seedRegionDetail(regionId), location, {
    status: "ready",
    progress: {
      regions: [{ id: regionId, state: "in-progress" }],
      locations: [{ id: location.id, state: "available", stars: 0 }],
      chapters,
      counts: NO_COUNTS,
    },
  });
}

// One chapter: Tivat's "Putujemo".
const tivat = openPlace("coast", seedLocationDetail("tivat"));
// Four chapters, 40 words.
const podgorica = openPlace("central", seedLocationDetail("podgorica"));
// Two chapters.
const ulcinj = openPlace("coast", seedLocationDetail("ulcinj"));

function renderScreen(data: LocationScreenData) {
  return render(<LocationScreen {...data} />);
}

function chapterCards() {
  return within(screen.getByRole("list", { name: "Chapters" })).getAllByRole(
    "link",
  );
}

describe("LocationScreen", () => {
  it("is headed with the place's name", () => {
    renderScreen(podgorica);

    expect(
      screen.getByRole("heading", { level: 1, name: "Podgorica" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Podgorica" }),
    ).toBeInTheDocument();
  });

  it.each<[string, LocationScreenData, string[]]>([
    ["one", tivat, ["Putujemo"]],
    [
      "four",
      podgorica,
      ["Kod kuće", "Povrće i ručak", "U kuhinji", "U vrtiću"],
    ],
  ])(
    "shows a card per chapter, in recording order (%s)",
    (_count, data, titles) => {
      renderScreen(data);

      expect(
        chapterCards().map(
          (card) => within(card).getByRole("heading", { level: 2 }).textContent,
        ),
      ).toEqual(titles);
    },
  );

  it("links each card to its chapter's screen", () => {
    renderScreen(podgorica);

    expect(chapterCards().map((card) => card.getAttribute("href"))).toEqual(
      podgorica.location.chapters.map(
        ({ id }) => `/play/central/podgorica/${id}`,
      ),
    );
  });

  it("leaves the words and the games to the chapter's screen", () => {
    renderScreen(podgorica);

    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Games" }),
    ).not.toBeInTheDocument();
  });

  it("names a card by its title, its words and its progress", () => {
    renderScreen(tivat);

    expect(chapterCards()[0]).toHaveAccessibleName(
      /^Putujemo\s*,\s*10 words\s*,\s*Start here$/,
    );
  });

  describe("a card's progress, from what the server sent", () => {
    it.each([
      ["todo", "locked", "locked", "Start here"],
      ["done", "available", "available", "1 of 3 done"],
      ["done", "completed", "available", "2 of 3 done"],
      ["done", "completed", "completed", "All done"],
    ] as const)(
      "lesson %s, memory %s, match %s: %s",
      (lesson, memory, match, label) => {
        renderScreen(
          openPlace("coast", seedLocationDetail("tivat"), [
            makeChapterState("tivat-travel", { lesson, memory, match }),
          ]),
        );

        expect(chapterCards()[0]).toHaveTextContent(label);
      },
    );

    it("claims none when progress has no state, and still opens", () => {
      renderScreen(openPlace("coast", seedLocationDetail("tivat"), []));

      const card = chapterCards()[0];
      expect(card).toHaveAccessibleName(/^Putujemo\s*,\s*10 words$/);
      expect(card).toHaveAttribute("href", "/play/coast/tivat/tivat-travel");
    });
  });

  describe("a card's pictures", () => {
    it("are the chapter's first three, decorative", () => {
      const place = seedLocationDetail("tivat");
      renderScreen(
        openPlace("coast", {
          ...place,
          chapters: place.chapters.map((chapter) => ({
            ...chapter,
            words: chapter.words.map((word) => ({
              ...word,
              imageUrl: `/media/words/${word.number}.webp`,
            })),
          })),
        }),
      );

      const images = Array.from(
        chapterCards()[0]?.querySelectorAll("img") ?? [],
      );
      expect(images.map((image) => image.getAttribute("src"))).toEqual([
        "/media/words/41.webp",
        "/media/words/42.webp",
        "/media/words/43.webp",
      ]);
      for (const image of images) {
        expect(image).toHaveAttribute("alt", "");
        expect(image.closest('[aria-hidden="true"]')).not.toBeNull();
      }
    });

    it("are placeholder art without a letter while there are no images", () => {
      renderScreen(tivat);

      const card = chapterCards()[0];
      expect(card?.querySelector("img")).toBeNull();
      expect(card?.querySelector("svg text")).toBeNull();
    });
  });

  it("marks the place's and the region's names as Montenegrin, and the English around them as not", () => {
    renderScreen(podgorica);

    expect(
      screen.getByRole("heading", { level: 1, name: "Podgorica" }),
    ).toHaveAttribute("lang", "sr-Latn-ME");
    const regionLink = screen.getByRole("link", {
      name: "Centralna Crna Gora",
    });
    expect(regionLink).toHaveAttribute("lang", "sr-Latn-ME");
    // "In", before the link, stays in the page's English.
    expect(regionLink.parentElement).toHaveTextContent(
      /^In\s*Centralna Crna Gora$/,
    );
    expect(regionLink.parentElement?.closest("[lang]")).toBeNull();

    const title = screen.getByRole("heading", { level: 2, name: "Kod kuće" });
    expect(title).toHaveAttribute("lang", "sr-Latn-ME");
    expect(title.closest("a")?.closest("[lang]")).toBeNull();
  });

  it("leads back to the region named by the location's own region id", () => {
    // The gate guarantees the two agree; the link follows the location.
    renderScreen({
      ...podgorica,
      region: { ...podgorica.region, id: "somewhere-else" },
    });

    expect(
      screen.getByRole("link", { name: "Centralna Crna Gora" }),
    ).toHaveAttribute("href", "/play/central");
  });

  it("has the region link, then each chapter's card, to focus", async () => {
    const user = userEvent.setup();
    renderScreen(podgorica);

    await user.tab();
    expect(
      screen.getByRole("link", { name: "Centralna Crna Gora" }),
    ).toHaveFocus();

    for (const card of chapterCards()) {
      await user.tab();
      expect(card).toHaveFocus();
    }

    await user.tab();
    expect(document.body).toHaveFocus();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each<[string, LocationScreenData]>([
    ["one chapter", tivat],
    ["four chapters", podgorica],
    ["two chapters", ulcinj],
    ["no progress", openPlace("coast", seedLocationDetail("tivat"), [])],
  ])("has no accessibility violations with %s", async (_case, data) => {
    const { container } = renderScreen(data);

    expect(await axe(container)).toHaveNoViolations();
  });
});
