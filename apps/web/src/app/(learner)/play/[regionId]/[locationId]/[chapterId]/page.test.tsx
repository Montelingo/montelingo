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

import { serveApi } from "../../../test-api";
import ChapterPage, { generateMetadata } from "./page";

// The real gate and the map's notFound() mapping run, over the fake API in
// ../../../test-api.ts.
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
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  ...navigation,
}));

function pageProps(regionId: string, locationId: string, chapterId: string) {
  return { params: Promise.resolve({ regionId, locationId, chapterId }) };
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

describe("ChapterPage", () => {
  it.each([
    [
      "podgorica-home",
      "Kod kuće",
      ["Lesson, Done", "Memory, Completed", "Match, Ready to play"],
    ],
    [
      "podgorica-vegetables",
      "Povrće i ručak",
      ["Lesson, Done", "Memory, Ready to play", "Match, Ready to play"],
    ],
    [
      "podgorica-kitchen",
      "U kuhinji",
      [
        "Lesson, Start here",
        "Memory, First watch the lesson",
        "Match, First watch the lesson",
      ],
    ],
  ])(
    "shows %s: its games in the server's states, and its words",
    async (id, title, games) => {
      render(await ChapterPage(pageProps("central", "podgorica", id)));

      expect(
        screen.getByRole("heading", { level: 1, name: title }),
      ).toBeInTheDocument();
      expect(
        within(screen.getByRole("list", { name: `${title} lesson and games` }))
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual(games);
      expect(screen.getAllByRole("figure")).toHaveLength(10);
    },
  );

  it.each([
    ["a chapter the place does not have", "central", "podgorica", "atlantis"],
    ["an unknown place", "central", "atlantis", "podgorica-home"],
    ["a place under another region", "coast", "podgorica", "podgorica-home"],
  ])("renders the not-found page for %s", async (_case, ...ids) => {
    await expect(ChapterPage(pageProps(...ids))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("sends a chapter of a locked place back to the region, which says why", async () => {
    await expect(
      ChapterPage(pageProps("coast", "kotor", "kotor-any")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(navigation.redirect).toHaveBeenCalledWith(
      "/play/coast?notice=location-locked",
    );
  });

  it("sends a learner whose session ended to sign in, then back to the chapter", async () => {
    serveApi(fetchMock, "signed-out");

    await expect(
      ChapterPage(pageProps("central", "podgorica", "podgorica-home")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(navigation.redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fcentral%2Fpodgorica%2Fpodgorica-home",
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      await ChapterPage(pageProps("central", "podgorica", "podgorica-home")),
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("generateMetadata", () => {
  it("titles the page with the chapter's title", async () => {
    await expect(
      generateMetadata(pageProps("central", "podgorica", "podgorica-home")),
    ).resolves.toEqual({ title: "Kod kuće" });
  });

  it("never gives a locked place's chapter, redirecting like the page", async () => {
    await expect(
      generateMetadata(pageProps("coast", "kotor", "kotor-any")),
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});
