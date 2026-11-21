import type { Schemas } from "@app/api-client";
import type { Mock } from "vitest";

// The fake API that the play pages' tests run the real loaders and gates over:
// the content of two regions and two places, as the API sends it, and the
// learner's progress, picked per test. Each test file still mocks
// `@/lib/api` itself, since Vitest hoists vi.mock() per file, and hands its
// `fetch` mock to serveApi(). Imported by tests only: not a route file (only
// Next.js's own file names are), and not a test (Vitest runs `*.test.ts(x)`).

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(status: number, code: string): Response {
  return jsonResponse(status, {
    error: { code, message: "API message", request_id: "req-1", details: null },
  });
}

// A region and its places, each place an [id, name] pair.
function apiRegion(
  id: string,
  name: string,
  locations: readonly (readonly [id: string, name: string])[],
): Schemas["RegionDetail"] {
  return {
    id,
    name,
    locations: locations.map(([locationId, locationName]) => ({
      id: locationId,
      name: locationName,
      region_id: id,
      chapter_count: 10,
      word_count: 100,
    })),
  };
}

// The three regions, from the content seed.
const REGIONS: Record<string, Schemas["RegionDetail"]> = {
  coast: apiRegion("coast", "Obala", [
    ["budva", "Budva"],
    ["kotor", "Kotor"],
    ["ulcinj", "Ulcinj"],
    ["herceg-novi", "Herceg Novi"],
    ["tivat", "Tivat"],
    ["bar", "Bar"],
  ]),
  central: apiRegion("central", "Centralna Crna Gora", [
    ["podgorica", "Podgorica"],
    ["cetinje", "Cetinje"],
    ["niksic", "Nikšić"],
    ["danilovgrad", "Danilovgrad"],
    ["skadar-lake", "Skadarsko jezero"],
  ]),
  north: apiRegion("north", "Sjever i planine", [
    ["durmitor", "Durmitor / Žabljak"],
    ["kolasin", "Kolašin"],
    ["berane", "Berane"],
    ["bijelo-polje", "Bijelo Polje"],
    ["pljevlja", "Pljevlja"],
    ["rozaje", "Rožaje"],
  ]),
};

// A word's UUID, made from its recording number.
function wordUuid(number: number): string {
  return `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
}

// A chapter of 10 words, numbered on from `first`, each with its picture or
// none. The words themselves do not matter here: LocationScreen's tests check
// the seed's.
function apiChapter(
  id: string,
  title: string,
  position: number,
  first: number,
  pictures: "pictures" | "no-pictures" = "no-pictures",
): Schemas["Chapter"] {
  return {
    id,
    title,
    position,
    words: Array.from({ length: 10 }, (_, index) => ({
      id: wordUuid(first + index),
      number: first + index,
      text: `riječ ${first + index}`,
      note: null,
      image_url:
        pictures === "pictures"
          ? `/media/words/${String(first + index).padStart(4, "0")}.webp`
          : null,
      audio_url: null,
    })),
  };
}

// Podgorica with the seed's four word groups, only "Povrće i ručak" with its
// pictures, and Kotor, which tests only ever find locked, so its words are
// never shown.
const LOCATIONS: Record<string, Schemas["LocationDetail"]> = {
  podgorica: {
    id: "podgorica",
    name: "Podgorica",
    region_id: "central",
    chapters: [
      apiChapter("podgorica-home", "Kod kuće", 11, 101),
      apiChapter("podgorica-vegetables", "Povrće i ručak", 14, 131, "pictures"),
      apiChapter("podgorica-kitchen", "U kuhinji", 15, 141),
      apiChapter("podgorica-kindergarten", "U vrtiću", 18, 171),
    ],
  },
  kotor: { id: "kotor", name: "Kotor", region_id: "coast", chapters: [] },
};

type ProgressBody = {
  regions: { id: string; state: string }[];
  locations: { id: string; state: string }[];
  chapters: Schemas["ChapterState"][];
};

// A chapter's state as the server sends it: both games, `memory` then `match`.
function apiChapterState(
  id: string,
  lesson: Schemas["ChapterState"]["lesson"],
  memory: Schemas["GameState"]["state"],
  match: Schemas["GameState"]["state"],
): Schemas["ChapterState"] {
  return {
    id,
    lesson,
    games: [
      { id: "memory", state: memory },
      { id: "match", state: match },
    ],
  };
}

// A new account: the coast and Budva open, everything else locked.
const NEW_ACCOUNT_PROGRESS: ProgressBody = {
  regions: [
    { id: "coast", state: "available" },
    { id: "central", state: "locked" },
    { id: "north", state: "locked" },
  ],
  locations: Object.values(REGIONS).flatMap(({ locations }) =>
    locations.map(({ id }) => ({
      id,
      state: id === "budva" ? "available" : "locked",
    })),
  ),
  // The server sends the chapters of every place that is not locked.
  chapters: [
    apiChapterState("budva-beach", "todo", "locked", "locked"),
    apiChapterState("budva-summer-clothes", "todo", "locked", "locked"),
  ],
};

// The coast done and the centre open, with Podgorica open and Kotor locked.
const PODGORICA_OPEN_PROGRESS: ProgressBody = {
  regions: [
    { id: "coast", state: "completed" },
    { id: "central", state: "available" },
    { id: "north", state: "locked" },
  ],
  locations: [
    { id: "budva", state: "completed" },
    { id: "kotor", state: "locked" },
    { id: "podgorica", state: "available" },
  ],
  // Budva's chapters done; Podgorica's in every state a chapter can be in.
  chapters: [
    apiChapterState("budva-beach", "done", "completed", "completed"),
    apiChapterState("budva-summer-clothes", "done", "completed", "completed"),
    apiChapterState("podgorica-home", "done", "completed", "available"),
    apiChapterState("podgorica-vegetables", "done", "available", "available"),
    apiChapterState("podgorica-kitchen", "todo", "locked", "locked"),
    apiChapterState("podgorica-kindergarten", "todo", "locked", "locked"),
  ],
};

/**
 * What the progress route answers: a new account's progress, Podgorica open
 * (with its chapters' states, or without any), a server error, no entries at
 * all, or a session that has ended.
 */
export type ProgressAnswer =
  | "new-account"
  | "podgorica-open"
  | "podgorica-open-without-chapters"
  | "failed"
  | "empty"
  | "signed-out";

function progressResponse(progress: ProgressAnswer): Response {
  switch (progress) {
    case "new-account":
      return jsonResponse(200, NEW_ACCOUNT_PROGRESS);
    case "podgorica-open":
      return jsonResponse(200, PODGORICA_OPEN_PROGRESS);
    case "podgorica-open-without-chapters":
      return jsonResponse(200, { ...PODGORICA_OPEN_PROGRESS, chapters: [] });
    case "failed":
      return errorResponse(500, "internal_server_error");
    case "empty":
      return jsonResponse(200, { regions: [], locations: [], chapters: [] });
    case "signed-out":
      return errorResponse(401, "authentication_error");
  }
}

/**
 * Makes `fetchMock` answer like the API: progress as `progress` says, the
 * child profile as `profile` says (or `401` when signed out), the list of
 * regions, and a region or place by its exact id, as the API does, or `404`
 * for one it does not have.
 */
export function serveApi(
  fetchMock: Mock<(request: Request) => Promise<Response>>,
  progress: ProgressAnswer = "new-account",
  profile: "set-up" | "not-set-up" = "set-up",
): void {
  fetchMock.mockImplementation((request) => {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/v1/profile") {
      // A set-up profile, or one that is not; a session that ended is signed
      // out here too.
      return Promise.resolve(
        progress === "signed-out"
          ? errorResponse(401, "authentication_error")
          : jsonResponse(
              200,
              profile === "set-up"
                ? {
                    name: "Mia",
                    age_band: "5-6",
                    avatar: "owl",
                    is_complete: true,
                  }
                : {
                    name: null,
                    age_band: null,
                    avatar: null,
                    is_complete: false,
                  },
            ),
      );
    }
    if (pathname === "/api/v1/progress") {
      return Promise.resolve(progressResponse(progress));
    }
    if (pathname === "/api/v1/regions") {
      return Promise.resolve(
        jsonResponse(200, {
          items: Object.values(REGIONS).map(({ id, name, locations }) => ({
            id,
            name,
            location_count: locations.length,
          })),
          page: { has_more: false, next_cursor: null },
        }),
      );
    }
    const [, kind, id] =
      /^\/api\/v1\/(regions|locations)\/([^/]+)$/.exec(pathname) ?? [];
    const table = kind === "regions" ? REGIONS : LOCATIONS;
    // Own keys only, so an id like `constructor` is a 404 too.
    const content =
      id !== undefined && Object.hasOwn(table, id) ? table[id] : undefined;
    return Promise.resolve(
      content === undefined
        ? errorResponse(404, "content_not_found")
        : jsonResponse(200, content),
    );
  });
}
