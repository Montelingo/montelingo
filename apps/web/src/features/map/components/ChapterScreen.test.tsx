import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import type { LocationDetail } from "../model/content";
import {
  type ChapterScreenData,
  toChapterScreen,
  toLocationScreen,
} from "../model/screens";
import {
  makeChapterState,
  NO_COUNTS,
  seedLocationDetail,
  seedRegionDetail,
} from "../test-fixtures";
import { ChapterScreen } from "./ChapterScreen";

// A chapter of a place the server has opened, as its loader returns it, with
// no chapter started.
function openChapter(
  regionId: Parameters<typeof seedRegionDetail>[0],
  location: LocationDetail,
  chapterId = location.chapters[0]?.id ?? "",
): ChapterScreenData {
  const place = toLocationScreen(seedRegionDetail(regionId), location, {
    status: "ready",
    progress: {
      regions: [{ id: regionId, state: "in-progress" }],
      locations: [{ id: location.id, state: "available" }],
      chapters: location.chapters.map(({ id }) => makeChapterState(id)),
      counts: NO_COUNTS,
    },
  });
  const chapter = toChapterScreen(place, chapterId);
  if (chapter === null) {
    throw new Error(`No chapter ${chapterId}`);
  }
  return chapter;
}

const tivat = openChapter("coast", seedLocationDetail("tivat"));
const podgorica = openChapter("central", seedLocationDetail("podgorica"));
// Ulcinj's chapter with the seed's one note: word 86, "zmaj".
const ulcinjPlace = seedLocationDetail("ulcinj");
const chapterWith = (text: string) =>
  openChapter(
    "coast",
    ulcinjPlace,
    ulcinjPlace.chapters.find(({ words }) =>
      words.some((word) => word.text === text),
    )?.id,
  );

// Tivat, its first word (41, "avion") with a picture, as phase 2 will send.
const AIRPLANE_URL = "https://media.example/words/0041.webp";
const tivatPlace = seedLocationDetail("tivat");
const tivatWithPicture = openChapter("coast", {
  ...tivatPlace,
  chapters: tivatPlace.chapters.map((chapter) => ({
    ...chapter,
    words: chapter.words.map((word) =>
      word.number === 41 ? { ...word, imageUrl: AIRPLANE_URL } : word,
    ),
  })),
});

function renderScreen(data: ChapterScreenData) {
  return render(<ChapterScreen {...data} />);
}

function words() {
  return within(screen.getByRole("list", { name: "Words" })).getAllByRole(
    "figure",
  );
}

// A word card's name, the word then its note: "zmaj, igračka koja leti".
// Name computations differ in the space they put before the note, which
// sits in a part of the caption only screen readers get (Testing Library
// adds one), so any space around the comma is allowed.
function wordAndNote(word: string, note: string): RegExp {
  return new RegExp(`^${word}\\s*,\\s*${note}$`);
}

function caption(figure: HTMLElement): HTMLElement {
  const element = figure.querySelector("figcaption");
  if (element === null) {
    throw new Error("The word card has no caption");
  }
  return element;
}

describe("ChapterScreen", () => {
  it("is headed with the chapter's title, marked as Montenegrin", () => {
    renderScreen(tivat);

    expect(
      screen.getByRole("heading", { level: 1, name: "Putujemo" }),
    ).toHaveAttribute("lang", "sr-Latn-ME");
    expect(
      screen.getByRole("region", { name: "Putujemo" }),
    ).toBeInTheDocument();
  });

  it("leads back to its place", () => {
    renderScreen(podgorica);

    const link = screen.getByRole("link", { name: "Podgorica" });
    expect(link).toHaveAttribute("href", "/play/central/podgorica");
    expect(link).toHaveAttribute("lang", "sr-Latn-ME");
  });

  it("shows its 10 words, in recording order", () => {
    renderScreen(tivat);

    expect(words().map((word) => caption(word).textContent)).toEqual([
      "avion",
      "aerodrom",
      "autobus",
      "automobil",
      "bicikl",
      "voz",
      "karta",
      "kofer",
      "točak",
      "put",
    ]);
  });

  it("shows only its own words and games, not the place's other chapters'", () => {
    renderScreen(podgorica);

    expect(screen.getAllByRole("figure")).toHaveLength(10);
    expect(screen.getAllByRole("list")).toEqual([
      screen.getByRole("list", { name: "Kod kuće lesson and games" }),
      screen.getByRole("list", { name: "Words" }),
    ]);
  });

  it("has its games above its words", () => {
    renderScreen(tivat);

    expect(
      screen
        .getByRole("region", { name: "Games" })
        .compareDocumentPosition(screen.getByRole("list", { name: "Words" })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("names each word card by its word, marked as Montenegrin", () => {
    renderScreen(tivat);

    expect(screen.getByRole("figure", { name: "avion" })).toHaveAttribute(
      "lang",
      "sr-Latn-ME",
    );
  });

  it("says a word's note after the word, without showing it", () => {
    const word = "zmaj";
    const note = "igračka koja leti";
    renderScreen(chapterWith(word));

    const card = screen.getByRole("figure", { name: wordAndNote(word, note) });
    // The visible caption is the word alone; the note is for screen readers.
    const [shown, hidden, ...rest] = Array.from(caption(card).childNodes);
    expect(shown?.nodeType).toBe(Node.TEXT_NODE);
    expect(shown?.textContent).toBe(word);
    expect(hidden).toHaveClass("sr-only");
    expect(hidden).toHaveTextContent(`, ${note}`);
    expect(rest).toEqual([]);
  });

  it("names a word without a note by the word alone", () => {
    renderScreen(chapterWith("riba"));

    const card = screen.getByRole("figure", { name: "riba" });
    expect(caption(card)).toHaveTextContent(/^riba$/);
  });

  describe("a word's picture", () => {
    it("is the placeholder art when the word has no image", () => {
      renderScreen(tivat);

      const card = screen.getByRole("figure", { name: "avion" });
      expect(card.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      expect(card.querySelector("img")).toBeNull();
    });

    it("is the word's image when it has one, and decorative", () => {
      renderScreen(tivatWithPicture);

      const card = screen.getByRole("figure", { name: "avion" });
      const image = card.querySelector("img");
      expect(image).toHaveAttribute("src", AIRPLANE_URL);
      expect(image).toHaveAttribute("alt", "");
      expect(card.querySelector("svg")).toBeNull();
      // The next word still has no image, so it keeps the placeholder.
      expect(
        screen.getByRole("figure", { name: "aerodrom" }).querySelector("svg"),
      ).not.toBeNull();
    });
  });

  it("has the place link, then the lesson, to focus: the words and locked games are not controls", async () => {
    const user = userEvent.setup();
    renderScreen(podgorica);

    await user.tab();
    expect(screen.getByRole("link", { name: "Podgorica" })).toHaveFocus();
    await user.tab();
    expect(document.activeElement).toHaveAttribute(
      "href",
      "/play/central/podgorica/podgorica-home/lesson",
    );
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it.each<[string, ChapterScreenData]>([
    ["a chapter", tivat],
    ["a word with a note", chapterWith("zmaj")],
    ["a word with an image", tivatWithPicture],
  ])("has no accessibility violations for %s", async (_case, data) => {
    const { container } = renderScreen(data);

    expect(await axe(container)).toHaveNoViolations();
  });
});
