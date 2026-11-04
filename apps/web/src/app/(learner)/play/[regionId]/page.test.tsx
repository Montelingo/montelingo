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

import RegionPage, { generateMetadata } from "./page";

// The real loaders and the map's notFound() mapping run, over a fake API.
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
  useRouter: () => ({ refresh: vi.fn() }),
  // The URL as it is now, like Next.js, whose router follows
  // history.replaceState().
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse(status, {
    error: { code, message: "API message", request_id: "req-1", details: null },
  });
}

function makeLocationSummary(id: string, name: string, regionId: string) {
  return { id, name, region_id: regionId, chapter_count: 10, word_count: 100 };
}

const REGIONS: Record<string, unknown> = {
  coast: {
    id: "coast",
    name: "Obala",
    locations: [
      ["budva", "Budva"],
      ["kotor", "Kotor"],
      ["ulcinj", "Ulcinj"],
      ["herceg-novi", "Herceg Novi"],
      ["tivat", "Tivat"],
      ["bar", "Bar"],
    ].map(([id = "", name = ""]) => makeLocationSummary(id, name, "coast")),
  },
  central: {
    id: "central",
    name: "Centralna Crna Gora",
    locations: [
      ["podgorica", "Podgorica"],
      ["cetinje", "Cetinje"],
      ["niksic", "Nikšić"],
      ["danilovgrad", "Danilovgrad"],
      ["skadar-lake", "Skadarsko jezero"],
    ].map(([id = "", name = ""]) => makeLocationSummary(id, name, "central")),
  },
};

// A new account: the coast and Budva open, everything else locked.
const NEW_ACCOUNT_PROGRESS = {
  regions: [
    { id: "coast", state: "available" },
    { id: "central", state: "locked" },
    { id: "north", state: "locked" },
  ],
  locations: [
    { id: "budva", state: "available" },
    ...["kotor", "ulcinj", "herceg-novi", "tivat", "bar"].map((id) => ({
      id,
      state: "locked",
    })),
  ],
};

type ProgressAnswer = "new-account" | "failed" | "empty" | "signed-out";

function serveApi(progress: ProgressAnswer = "new-account") {
  fetchMock.mockImplementation((request) => {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/v1/progress") {
      return Promise.resolve(
        {
          "new-account": jsonResponse(200, NEW_ACCOUNT_PROGRESS),
          failed: errorResponse(500, "internal_server_error"),
          empty: jsonResponse(200, { regions: [], locations: [] }),
          "signed-out": errorResponse(401, "authentication_error"),
        }[progress],
      );
    }
    const regionId = /^\/api\/v1\/regions\/([^/]+)$/.exec(pathname)?.[1];
    const region = regionId === undefined ? undefined : REGIONS[regionId];
    return Promise.resolve(
      region === undefined
        ? errorResponse(404, "content_not_found")
        : jsonResponse(200, region),
    );
  });
}

function pageProps(
  regionId: string,
  searchParams: { notice?: string | string[] } = {},
) {
  return {
    params: Promise.resolve({ regionId }),
    searchParams: Promise.resolve(searchParams),
  };
}

// Puts the page's URL in the browser, which useSearchParams() reads.
function visit(path: string, { notice }: { notice?: string | string[] } = {}) {
  const query = new URLSearchParams();
  for (const value of [notice ?? []].flat()) {
    query.append("notice", value);
  }
  const search = query.toString();
  window.history.replaceState(
    null,
    "",
    search === "" ? path : `${path}?${search}`,
  );
}

async function renderPage(
  regionId: string,
  searchParams?: { notice?: string | string[] },
) {
  visit(`/play/${regionId}`, searchParams);
  return render(await RegionPage(pageProps(regionId, searchParams)));
}

function places() {
  return within(screen.getByRole("list", { name: "Places" }));
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.clearAllMocks();
  serveApi();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  window.history.replaceState(null, "", "/");
});

describe("RegionPage", () => {
  it("shows an open region's places, Budva open as the next stop and the rest locked", async () => {
    await renderPage("coast");

    expect(
      screen.getByRole("heading", { level: 1, name: "Obala" }),
    ).toBeInTheDocument();
    expect(
      places()
        .getAllByRole("link")
        .map((card) => card.getAttribute("aria-label")),
    ).toEqual([
      "Budva, Open, Next stop",
      "Kotor, Locked",
      "Ulcinj, Locked",
      "Herceg Novi, Locked",
      "Tivat, Locked",
      "Bar, Locked",
    ]);
    expect(
      places().getByRole("link", { name: "Budva, Open, Next stop" }),
    ).toHaveAttribute("href", "/play/coast/budva");
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("says why the learner was sent back from a locked place", async () => {
    await renderPage("coast", { notice: "location-locked" });

    expect(
      screen.getByText(
        "That place isn’t open yet. Keep exploring the open places to reach it.",
      ),
    ).toBeVisible();
  });

  it.each<[string, string | string[]]>([
    ["an unknown notice", "account-deleted"],
    ["a repeated parameter", ["location-locked", "location-locked"]],
  ])("shows no notice for %s", async (_case, notice) => {
    await renderPage("coast", { notice });

    expect(screen.queryByText(/isn’t open yet/)).not.toBeInTheDocument();
  });

  it("renders the not-found page for an unknown region", async () => {
    await expect(RegionPage(pageProps("atlantis"))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    expect(navigation.notFound).toHaveBeenCalledTimes(1);
    expect(navigation.redirect).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.map(([request]) => request.url)).toContain(
      "http://api.test/api/v1/regions/atlantis",
    );
  });

  it("sends a locked region back to the map, which says why, rendering nothing", async () => {
    await expect(RegionPage(pageProps("central"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(navigation.redirect).toHaveBeenCalledTimes(1);
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/play?notice=region-locked",
    );
    expect(navigation.notFound).not.toHaveBeenCalled();
  });

  it("stays on the region when progress failed, its places not loaded, with a retry", async () => {
    serveApi("failed");

    await renderPage("coast");

    expect(navigation.redirect).not.toHaveBeenCalled();
    expect(places().getAllByRole("link")).toHaveLength(6);
    expect(
      places().getByRole("link", { name: "Budva, Not loaded" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("stays on a region whose state is still loading", async () => {
    serveApi("empty");

    await renderPage("central");

    expect(navigation.redirect).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { level: 1, name: "Centralna Crna Gora" }),
    ).toBeInTheDocument();
    expect(
      places().getByRole("link", { name: "Podgorica, Loading" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("sends a learner whose session ended mid-visit to sign in, then back to the region", async () => {
    serveApi("signed-out");

    await expect(RegionPage(pageProps("coast"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(navigation.redirect).toHaveBeenCalledTimes(1);
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fcoast",
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("sends the learner to sign in when the content call finds the session ended too", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorResponse(401, "authentication_error")),
    );

    await expect(RegionPage(pageProps("coast"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fcoast",
    );
    expect(navigation.notFound).not.toHaveBeenCalled();
  });

  it("lets a failed region reach the error boundary", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorResponse(500, "internal_server_error")),
    );

    await expect(RegionPage(pageProps("coast"))).rejects.toThrow();
    expect(navigation.notFound).not.toHaveBeenCalled();
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage("coast", {
      notice: "location-locked",
    });

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("generateMetadata", () => {
  it("titles the page with the region's name, without reading progress", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ regionId: "coast" }) }),
    ).resolves.toEqual({ title: "Obala" });
    expect(
      fetchMock.mock.calls.map(([request]) => new URL(request.url).pathname),
    ).toEqual(["/api/v1/regions/coast"]);
  });

  it("renders the not-found page for an unknown region", async () => {
    await expect(
      generateMetadata({ params: Promise.resolve({ regionId: "atlantis" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("sends a learner whose session ended to sign in, like the page", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorResponse(401, "authentication_error")),
    );

    await expect(
      generateMetadata({ params: Promise.resolve({ regionId: "coast" }) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fcoast",
    );
  });
});
