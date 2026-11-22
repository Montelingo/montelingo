import { type ApiClient, createApiClient } from "@app/api-client";
import type * as Navigation from "next/navigation";
import { render, screen, within } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { axe } from "vitest-axe";

import { serveApi } from "../../../../test-api";
import MatchPage, { generateMetadata } from "./page";

// The real gate runs, over the fake API in play/test-api.ts. With Podgorica
// open, its chapters are: "Kod kuće" (match available, no pictures),
// "Povrće i ručak" (match available, with pictures), and "U kuhinji" and
// "U vrtiću" (match locked).
const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);
vi.mock("@/lib/api", () => ({
  getApiClient: (): ApiClient =>
    createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
}));

// Like Next.js, redirect() and notFound() throw, so nothing after them runs.
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  // The page's client side saves the result and refreshes the router (#136).
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  ...navigation,
}));

function pageProps(regionId: string, locationId: string, chapterId: string) {
  return { params: Promise.resolve({ regionId, locationId, chapterId }) };
}

async function renderPage(chapterId: string) {
  return render(await MatchPage(pageProps("central", "podgorica", chapterId)));
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.clearAllMocks();
  serveApi(fetchMock, "podgorica-open");
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("MatchPage", () => {
  it("shows the match game of a chapter whose game the server opened", async () => {
    await renderPage("podgorica-vegetables");

    expect(
      screen.getByRole("heading", { level: 1, name: "Match: Povrće i ručak" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Spoji riječ i sliku" }),
    ).toBeInTheDocument();
    // A picture, and three of the chapter's words to pick from.
    expect(
      within(
        screen.getByRole("group", { name: "Spoji riječ i sliku" }),
      ).getAllByRole("button"),
    ).toHaveLength(3);
    expect(navigation.redirect).not.toHaveBeenCalled();
    expect(navigation.notFound).not.toHaveBeenCalled();
  });

  it("marks the chapter's title as Montenegrin", async () => {
    await renderPage("podgorica-vegetables");

    expect(screen.getByText("Povrće i ručak")).toHaveAttribute(
      "lang",
      "sr-Latn-ME",
    );
  });

  it("shows the lock message, not the game, for a locked game opened by URL", async () => {
    await renderPage("podgorica-kitchen");

    expect(
      screen.getByRole("heading", { level: 1, name: "Match: U kuhinji" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("First watch the lesson. Then you can play."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Watch the lesson" }),
    ).toHaveAttribute(
      "href",
      "/play/central/podgorica/podgorica-kitchen/lesson",
    );
    expect(
      screen.queryByRole("group", { name: "Spoji riječ i sliku" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("says the game did not load, and shows no game, when progress has no state for the chapter", async () => {
    serveApi(fetchMock, "podgorica-open-without-chapters");

    await renderPage("podgorica-vegetables");

    expect(
      screen.getByText(
        "This game didn’t load. Something went wrong on our side.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to the place" }),
    ).toHaveAttribute("href", "/play/central/podgorica");
    expect(
      screen.queryByRole("group", { name: "Spoji riječ i sliku" }),
    ).not.toBeInTheDocument();
  });

  it("says the pictures are coming, rather than show an empty screen, for an open game without enough pictures", async () => {
    await renderPage("podgorica-home");

    expect(
      screen.getByText("This game’s pictures are coming soon."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to the place" }),
    ).toHaveAttribute("href", "/play/central/podgorica");
    expect(
      screen.queryByRole("group", { name: "Spoji riječ i sliku" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["an unknown chapter", "central", "podgorica", "atlantis"],
    ["another place's chapter", "central", "podgorica", "budva-beach"],
    ["an unknown place", "central", "atlantis", "podgorica-home"],
    ["a place under the wrong region", "coast", "podgorica", "podgorica-home"],
  ])(
    "renders the not-found page for %s",
    async (_case, regionId, locationId, chapterId) => {
      await expect(
        MatchPage(pageProps(regionId, locationId, chapterId)),
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(navigation.redirect).not.toHaveBeenCalled();
    },
  );

  it("renders the not-found page for a game the chapter's state does not list", async () => {
    // Progress lists only `memory` for "Povrće i ručak".
    const serve = fetchMock.getMockImplementation();
    if (serve === undefined) {
      throw new Error("serveApi() set no implementation");
    }
    fetchMock.mockImplementation(async (request) => {
      const response = await serve(request);
      if (new URL(request.url).pathname !== "/api/v1/progress") {
        return response;
      }
      const body = (await response.json()) as {
        chapters: { id: string; games: { id: string }[] }[];
      };
      return Response.json({
        ...body,
        chapters: body.chapters.map((chapter) => ({
          ...chapter,
          games: chapter.games.filter(({ id }) => id !== "match"),
        })),
      });
    });

    await expect(
      MatchPage(pageProps("central", "podgorica", "podgorica-vegetables")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("sends a game in a locked place back to the place's region, which says why", async () => {
    await expect(
      MatchPage(pageProps("coast", "kotor", "kotor-old-town")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(navigation.redirect).toHaveBeenCalledWith(
      "/play/coast?notice=location-locked",
    );
  });

  it("sends a learner whose session ended to sign in, then back to the game", async () => {
    serveApi(fetchMock, "signed-out");

    await expect(
      MatchPage(pageProps("central", "podgorica", "podgorica-vegetables")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(navigation.redirect).toHaveBeenCalledTimes(1);
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fcentral%2Fpodgorica%2Fpodgorica-vegetables%2Fmatch",
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each(["podgorica-vegetables", "podgorica-kitchen"])(
    "has no accessibility violations (%s)",
    async (chapterId) => {
      const { container } = await renderPage(chapterId);

      expect(await axe(container)).toHaveNoViolations();
    },
  );
});

describe("generateMetadata", () => {
  it("titles the page with the game and the chapter", async () => {
    await expect(
      generateMetadata(pageProps("central", "podgorica", "podgorica-home")),
    ).resolves.toEqual({ title: "Match: Kod kuće" });
  });

  it("renders the not-found page for an unknown chapter", async () => {
    await expect(
      generateMetadata(pageProps("central", "podgorica", "atlantis")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
