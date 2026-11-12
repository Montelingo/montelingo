import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";

import type { LocationDetail } from "../model/content";
import { type LocationScreenData, toLocationScreen } from "../model/screens";
import { seedLocationDetail, seedRegionDetail } from "../test-fixtures";
import { LocationScreen } from "./LocationScreen";

// A place the server has opened, in its open region, as the gate returns it.
function openPlace(
  regionId: Parameters<typeof seedRegionDetail>[0],
  location: LocationDetail,
): LocationScreenData {
  return toLocationScreen(seedRegionDetail(regionId), location, {
    status: "ready",
    progress: {
      regions: [{ id: regionId, state: "in-progress" }],
      locations: [{ id: location.id, state: "available" }],
    },
  });
}

// One group: Tivat's "Putujemo".
const tivat = openPlace("coast", seedLocationDetail("tivat"));
// Four groups, 40 words.
const podgorica = openPlace("central", seedLocationDetail("podgorica"));
// Two groups, with the seed's two notes.
const ulcinj = openPlace("coast", seedLocationDetail("ulcinj"));

// Tivat, its first word (41, "avion") with a picture, as phase 2 will send.
const AIRPLANE_URL = "https://media.example/words/0041.webp";
const tivatPlace = seedLocationDetail("tivat");
const tivatWithPicture = openPlace("coast", {
  ...tivatPlace,
  chapters: tivatPlace.chapters.map((chapter) => ({
    ...chapter,
    words: chapter.words.map((word) =>
      word.number === 41 ? { ...word, imageUrl: AIRPLANE_URL } : word,
    ),
  })),
});

function renderScreen(data: LocationScreenData) {
  return render(<LocationScreen {...data} />);
}

// The word groups' headings: every level-2 heading but the games area's.
function groupTitles() {
  return screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent ?? "")
    .filter((title) => title !== "Games");
}

function wordsIn(groupTitle: string) {
  return within(screen.getByRole("list", { name: groupTitle })).getAllByRole(
    "figure",
  );
}

// A word card's name, the word then its note: "zvijezda, morska zvijezda".
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

  it("shows a town with one group: its title and its 10 words", () => {
    renderScreen(tivat);

    expect(groupTitles()).toEqual(["Putujemo"]);
    expect(
      wordsIn("Putujemo").map((word) => caption(word).textContent),
    ).toEqual([
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

  it("shows a town with four groups in recording order, 10 words each", () => {
    renderScreen(podgorica);

    expect(groupTitles()).toEqual([
      "Kod kuće",
      "Povrće i ručak",
      "U kuhinji",
      "U vrtiću",
    ]);
    for (const title of groupTitles()) {
      expect(wordsIn(title)).toHaveLength(10);
    }
    expect(screen.getAllByRole("figure")).toHaveLength(40);
    expect(wordsIn("U vrtiću").slice(0, 3)).toEqual([
      screen.getByRole("figure", { name: "vrtić" }),
      screen.getByRole("figure", { name: "dijete" }),
      screen.getByRole("figure", { name: "drug" }),
    ]);
  });

  it("names each word card by its word, marked as Montenegrin", () => {
    renderScreen(tivat);

    expect(screen.getByRole("figure", { name: "avion" })).toHaveAttribute(
      "lang",
      "sr-Latn-ME",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Putujemo" }),
    ).toHaveAttribute("lang", "sr-Latn-ME");
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

    const games = screen.getByRole("region", { name: "Games" });
    expect(within(games).getByText("Podgorica")).toHaveAttribute(
      "lang",
      "sr-Latn-ME",
    );
    expect(games.closest("[lang]")).toBeNull();
  });

  it.each([
    ["zvijezda", "morska zvijezda"],
    ["zmaj", "igračka koja leti"],
  ])("says the note of %s after the word, without showing it", (word, note) => {
    renderScreen(ulcinj);

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
    renderScreen(ulcinj);

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

  describe("the games area", () => {
    it("is one clearly marked region, before the words", () => {
      renderScreen(podgorica);

      const games = screen.getByRole("region", { name: "Games" });
      // The word groups are not landmarks: only the screen and the games are.
      expect(screen.getAllByRole("region")).toEqual([
        screen.getByRole("region", { name: "Podgorica" }),
        games,
      ]);
      expect(
        games.compareDocumentPosition(
          screen.getByRole("heading", { level: 2, name: "Kod kuće" }),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("says the place's games are coming, with nothing to press", () => {
      renderScreen(podgorica);

      const games = screen.getByRole("region", { name: "Games" });
      const note = within(games).getByText(/^Games for/);
      expect(note).toHaveTextContent("Games for Podgorica are coming soon.");
      expect(note).toBeVisible();
      expect(within(games).queryByRole("button")).not.toBeInTheDocument();
      expect(within(games).queryByRole("link")).not.toBeInTheDocument();
      expect(within(games).queryByRole("status")).not.toBeInTheDocument();
      expect(within(games).queryByRole("alert")).not.toBeInTheDocument();
      expect(games.querySelector("[aria-disabled], [tabindex]")).toBeNull();
    });
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

  it("has only the region link to focus: the words and the games area are not controls", async () => {
    const user = userEvent.setup();
    renderScreen(podgorica);

    await user.tab();
    expect(
      screen.getByRole("link", { name: "Centralna Crna Gora" }),
    ).toHaveFocus();

    await user.tab();
    expect(document.body).toHaveFocus();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each<[string, LocationScreenData]>([
    ["a town with one group", tivat],
    ["a town with four groups", podgorica],
    ["words with notes", ulcinj],
    ["a word with an image", tivatWithPicture],
  ])("has no accessibility violations for %s", async (_case, data) => {
    const { container } = renderScreen(data);

    expect(await axe(container)).toHaveNoViolations();
  });
});
