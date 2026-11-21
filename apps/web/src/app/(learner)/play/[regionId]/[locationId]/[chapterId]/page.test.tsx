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

import { serveApi } from "../../../test-api";
import { LearnerShell } from "@/features/learner";

import ChapterPage from "./page";

// The real gate runs, over the fake API in play/test-api.ts.
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
  usePathname: vi.fn(() => "/play"),
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
  it("leads to the chapter's place", async () => {
    await expect(
      ChapterPage(pageProps("central", "podgorica", "podgorica-home")),
    ).rejects.toThrow("NEXT_REDIRECT /play/central/podgorica");

    expect(navigation.redirect).toHaveBeenCalledTimes(1);
    expect(navigation.redirect).toHaveBeenCalledWith("/play/central/podgorica");
  });

  it.each([
    "/play/central/podgorica/podgorica-home/lesson",
    "/play/central/podgorica/podgorica-home/memory",
  ])(
    "is where the learner area's Back on %s goes, so Back returns to the place",
    (pathname) => {
      navigation.usePathname.mockReturnValue(pathname);

      render(
        <LearnerShell homeHref="/play" exitHref="/">
          <p>Lesson</p>
        </LearnerShell>,
      );

      expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
        "href",
        "/play/central/podgorica/podgorica-home",
      );
    },
  );

  it.each([
    ["an unknown chapter", "central", "podgorica", "atlantis"],
    ["another place's chapter", "central", "podgorica", "budva-beach"],
  ])(
    "renders the not-found page for %s",
    async (_case, regionId, locationId, chapterId) => {
      await expect(
        ChapterPage(pageProps(regionId, locationId, chapterId)),
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(navigation.redirect).not.toHaveBeenCalled();
    },
  );

  it("sends a chapter of a locked place back to its region, which says why", async () => {
    await expect(
      ChapterPage(pageProps("coast", "kotor", "kotor-old-town")),
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
  });
});
