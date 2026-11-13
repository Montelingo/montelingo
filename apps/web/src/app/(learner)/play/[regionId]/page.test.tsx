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

import { errorResponse, serveApi } from "../test-api";
import RegionPage, { generateMetadata } from "./page";

// The real loaders and the map's notFound() mapping run, over the fake API
// in ../test-api.ts.
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
  serveApi(fetchMock);
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
    serveApi(fetchMock, "failed");

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
    serveApi(fetchMock, "empty");

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
    serveApi(fetchMock, "signed-out");

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
