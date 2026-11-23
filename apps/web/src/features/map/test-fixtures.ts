import { act, fireEvent } from "@testing-library/react";
import { vi } from "vitest";

import type {
  Chapter,
  Location,
  LocationDetail,
  Region,
  RegionDetail,
  Word,
} from "./model/content";
import type {
  ChapterState,
  GameState,
  ProgressCounts,
  ProgressResult,
} from "./model/progress";

// Test data for the map feature's tests, mirroring the content seed
// (apps/api/app/modules/content/data/content.json): three regions in content
// order, 6, 5 and 6 locations, and Budva, first on the coast, as the start;
// and the word groups of three places: Podgorica (four), Ulcinj (two, with
// the seed's one note, on word 86) and Tivat (one). Imported by tests only.

const SEED_REGIONS = [
  {
    id: "coast",
    name: "Obala",
    locations: [
      ["budva", "Budva"],
      ["kotor", "Kotor"],
      ["ulcinj", "Ulcinj"],
      ["herceg-novi", "Herceg Novi"],
      ["tivat", "Tivat"],
      ["bar", "Bar"],
    ],
  },
  {
    id: "central",
    name: "Centralna Crna Gora",
    locations: [
      ["podgorica", "Podgorica"],
      ["cetinje", "Cetinje"],
      ["niksic", "Nikšić"],
      ["danilovgrad", "Danilovgrad"],
      ["skadar-lake", "Skadarsko jezero"],
    ],
  },
  {
    id: "north",
    name: "Sjever i planine",
    locations: [
      ["durmitor", "Durmitor / Žabljak"],
      ["kolasin", "Kolašin"],
      ["berane", "Berane"],
      ["bijelo-polje", "Bijelo Polje"],
      ["pljevlja", "Pljevlja"],
      ["rozaje", "Rožaje"],
    ],
  },
] as const;

type SeedRegionId = (typeof SEED_REGIONS)[number]["id"];

// Each chapter's position is its place in the seed's recording list (1–30).
const SEED_PLACES = {
  podgorica: {
    name: "Podgorica",
    regionId: "central",
    chapters: [
      {
        id: "podgorica-home",
        title: "Kod kuće",
        position: 11,
        words: seedWords(101, [
          "kuća",
          "vrata",
          "prozor",
          "sto",
          "stolica",
          "krevet",
          "ormar",
          "polica",
          "lampa",
          "tepih",
        ]),
      },
      {
        id: "podgorica-vegetables",
        title: "Povrće i ručak",
        position: 14,
        words: seedWords(131, [
          "krompir",
          "šargarepa",
          "paradajz",
          "krastavac",
          "paprika",
          "luk",
          "grašak",
          "pasulj",
          "kupus",
          "tikvica",
        ]),
      },
      {
        id: "podgorica-kitchen",
        title: "U kuhinji",
        position: 15,
        words: seedWords(141, [
          "tanjir",
          "čaša",
          "šolja",
          "kašika",
          "viljuška",
          "zdjela",
          "lonac",
          "poklopac",
          "slavina",
          "frižider",
        ]),
      },
      {
        id: "podgorica-kindergarten",
        title: "U vrtiću",
        position: 18,
        words: seedWords(171, [
          "vrtić",
          "dijete",
          "drug",
          "drugarica",
          "vaspitačica",
          "knjiga",
          "slikovnica",
          "olovka",
          "bojica",
          "papir",
        ]),
      },
    ],
  },
  ulcinj: {
    name: "Ulcinj",
    regionId: "coast",
    chapters: [
      {
        id: "ulcinj-sea-animals",
        title: "Morske životinje",
        position: 3,
        words: seedWords(21, [
          "riba",
          "rak",
          "školjka",
          "galeb",
          "hobotnica",
          "delfin",
          "meduza",
          "kornjača",
          "morski konjić",
          "morska zvijezda",
        ]),
      },
      {
        id: "ulcinj-play",
        title: "Igramo se",
        position: 9,
        words: seedWords(81, [
          "lopta",
          "kanta",
          "lopatica",
          "igračka",
          "balon",
          ["zmaj", "igračka koja leti"],
          "obruč",
          "kocka",
          "lutka",
          "plišanac",
        ]),
      },
    ],
  },
  tivat: {
    name: "Tivat",
    regionId: "coast",
    chapters: [
      {
        id: "tivat-travel",
        title: "Putujemo",
        position: 5,
        words: seedWords(41, [
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
        ]),
      },
    ],
  },
} satisfies Record<
  string,
  Omit<LocationDetail, "id"> & { regionId: SeedRegionId }
>;

type SeedPlaceId = keyof typeof SEED_PLACES;

// A chapter's words, numbered on from `first`, as the recording list numbers
// them; a word with a note is a [text, note] pair.
function seedWords(
  first: number,
  words: readonly (string | readonly [text: string, note: string])[],
): Word[] {
  return words.map((word, index) =>
    typeof word === "string"
      ? makeWord({ number: first + index, text: word })
      : makeWord({ number: first + index, text: word[0], note: word[1] }),
  );
}

export function makeRegion(overrides: Partial<Region> = {}): Region {
  return { id: "coast", name: "Obala", locationCount: 6, ...overrides };
}

export function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: "budva",
    name: "Budva",
    regionId: "coast",
    chapterCount: 10,
    wordCount: 100,
    ...overrides,
  };
}

// A word's UUID, made from its recording number so it is the same in every
// run. The API gives each environment its own (ADR 0005).
function wordId(number: number): string {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

export function makeWord(overrides: Partial<Word> = {}): Word {
  const number = overrides.number ?? 1;
  return {
    id: wordId(number),
    number,
    text: "more",
    note: null,
    imageUrl: null,
    audioUrl: null,
    ...overrides,
  };
}

export function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: "budva-beach",
    title: "Na plaži",
    position: 1,
    words: [makeWord()],
    ...overrides,
  };
}

export function makeLocationDetail(
  overrides: Partial<LocationDetail> = {},
): LocationDetail {
  return {
    id: "budva",
    name: "Budva",
    regionId: "coast",
    chapters: [makeChapter()],
    ...overrides,
  };
}

/**
 * One seed place with its chapters and words, in recording order, as
 * `getLocation()` returns it: Podgorica, Ulcinj, or Tivat.
 */
export function seedLocationDetail(id: SeedPlaceId): LocationDetail {
  return makeLocationDetail({ id, ...SEED_PLACES[id] });
}

/** The three seed regions, as `listRegions()` returns them. */
export function seedRegions(): Region[] {
  return SEED_REGIONS.map(({ id, name, locations }) =>
    makeRegion({ id, name, locationCount: locations.length }),
  );
}

/** One seed region with its locations, as `getRegion()` returns it. */
export function seedRegionDetail(regionId: SeedRegionId): RegionDetail {
  const region = SEED_REGIONS.find(({ id }) => id === regionId);
  if (region === undefined) {
    throw new Error(`No seed region ${regionId}`);
  }
  return {
    id: region.id,
    name: region.name,
    locations: region.locations.map(([id, name]) =>
      makeLocation({ id, name, regionId: region.id }),
    ),
  };
}

/** Every seed region with its locations, in content order, as `loadMap()` reads them. */
export function seedRegionDetails(): RegionDetail[] {
  return SEED_REGIONS.map(({ id }) => seedRegionDetail(id));
}

/** A child who has collected nothing yet. */
export const NO_COUNTS: ProgressCounts = { wordsLearned: 0, stickers: 0 };

/** Everything open: every region and place `available`, as a preview might. */
export function allOpenProgress(): ProgressResult {
  return {
    status: "ready",
    progress: {
      regions: SEED_REGIONS.map(({ id }) => ({ id, state: "available" })),
      locations: SEED_REGIONS.flatMap(({ locations }) =>
        locations.map(([id]) => ({ id, state: "available" as const })),
      ),
      chapters: [],
      counts: NO_COUNTS,
    },
  };
}

/**
 * A chapter's state as the server sends it: the lesson, then both games in the
 * server's order, `memory` then `match`. By default a chapter not started yet.
 */
export function makeChapterState(
  id: string,
  {
    lesson = "todo",
    memory = "locked",
    match = "locked",
  }: {
    lesson?: ChapterState["lesson"];
    memory?: GameState;
    match?: GameState;
  } = {},
): ChapterState {
  return {
    id,
    lesson,
    games: [
      { id: "memory", state: memory },
      { id: "match", state: match },
    ],
  };
}

/**
 * A new account's progress: the coast and Budva open, everything else locked,
 * and Budva's two chapters not started, their games locked.
 */
export function newAccountProgress(): ProgressResult {
  return {
    status: "ready",
    progress: {
      regions: SEED_REGIONS.map(({ id }) => ({
        id,
        state: id === "coast" ? "available" : "locked",
      })),
      locations: SEED_REGIONS.flatMap(({ locations }) =>
        locations.map(([id]) => ({
          id,
          state: id === "budva" ? "available" : "locked",
        })),
      ),
      chapters: [
        makeChapterState("budva-beach"),
        makeChapterState("budva-summer-clothes"),
      ],
      counts: NO_COUNTS,
    },
  };
}

/** Where the browser is now: the path, query and hash, as a test sets them. */
export function currentPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/**
 * A tap, as a pointer makes it: a click from the keyboard has no detail.
 * Synchronous, so it works under fake timers, which userEvent's async
 * wrapper would wait on for ever.
 */
export function tap(element: Element): void {
  fireEvent.click(element, { detail: 1 });
}

/** Moves the fake timers on, with what React renders as a result. */
export function advanceTimers(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}
