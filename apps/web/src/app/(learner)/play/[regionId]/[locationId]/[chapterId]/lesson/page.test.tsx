import { type ApiClient, createApiClient } from "@app/api-client";
import type * as Navigation from "next/navigation";
import { render, screen } from "@testing-library/react";
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
import LessonPage, { generateMetadata } from "./page";

// The real gate runs, over the fake API in play/test-api.ts. With Podgorica
// open, "Kod kuće"'s lesson is done and "U kuhinji"'s is not, its games
// still locked.
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
  return render(await LessonPage(pageProps("central", "podgorica", chapterId)));
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

describe("LessonPage", () => {
  it("shows the chapter's lesson, from its first word", async () => {
    await renderPage("podgorica-home");

    expect(
      screen.getByRole("heading", { level: 1, name: "Lesson: Kod kuće" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Kod kuće")).toHaveAttribute("lang", "sr-Latn-ME");
    expect(screen.getByRole("group", { name: "Prikaz" })).toBeInTheDocument();
    // The first of the chapter's ten words, 101 to 110.
    expect(screen.getByRole("status")).toHaveTextContent("riječ 101, 1 od 10");
    expect(navigation.redirect).not.toHaveBeenCalled();
    expect(navigation.notFound).not.toHaveBeenCalled();
  });

  it("shows the lesson of a chapter whose games are still locked: the lesson never is", async () => {
    await renderPage("podgorica-kitchen");

    expect(
      screen.getByRole("heading", { level: 1, name: "Lesson: U kuhinji" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("riječ 141, 1 od 10");
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
        LessonPage(pageProps(regionId, locationId, chapterId)),
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(navigation.redirect).not.toHaveBeenCalled();
    },
  );

  it("sends a lesson in a locked place back to the place's region, which says why", async () => {
    await expect(
      LessonPage(pageProps("coast", "kotor", "kotor-old-town")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(navigation.redirect).toHaveBeenCalledWith(
      "/play/coast?notice=location-locked",
    );
  });

  it("sends a learner whose session ended to sign in, then back to the lesson", async () => {
    serveApi(fetchMock, "signed-out");

    await expect(
      LessonPage(pageProps("central", "podgorica", "podgorica-home")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(navigation.redirect).toHaveBeenCalledTimes(1);
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fcentral%2Fpodgorica%2Fpodgorica-home%2Flesson",
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage("podgorica-home");

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("generateMetadata", () => {
  it("titles the page with the lesson's chapter", async () => {
    await expect(
      generateMetadata(pageProps("central", "podgorica", "podgorica-home")),
    ).resolves.toEqual({ title: "Lesson: Kod kuće" });
  });

  it("renders the not-found page for an unknown chapter", async () => {
    await expect(
      generateMetadata(pageProps("central", "podgorica", "atlantis")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
