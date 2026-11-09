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

import { errorResponse, serveApi } from "../../test-api";
import LocationPage, { generateMetadata } from "./page";

// The real gate and the map's notFound() mapping run, over the fake API in
// ../../test-api.ts.
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

function pageProps(regionId: string, locationId: string) {
  return { params: Promise.resolve({ regionId, locationId }) };
}

async function renderPage(regionId: string, locationId: string) {
  return render(await LocationPage(pageProps(regionId, locationId)));
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

describe("LocationPage", () => {
  it("shows an open town: its name, its region, the games area, and its four word groups", async () => {
    await renderPage("central", "podgorica");

    expect(
      screen.getByRole("heading", { level: 1, name: "Podgorica" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Centralna Crna Gora" }),
    ).toHaveAttribute("href", "/play/central");
    expect(screen.getByRole("region", { name: "Games" })).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual(["Games", "Kod kuće", "Povrće i ručak", "U kuhinji", "U vrtiću"]);
    expect(
      within(screen.getByRole("list", { name: "Kod kuće" })).getAllByRole(
        "figure",
      ),
    ).toHaveLength(10);
    expect(screen.getAllByRole("figure")).toHaveLength(40);
    expect(navigation.redirect).not.toHaveBeenCalled();
    expect(navigation.notFound).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown place", "central", "atlantis"],
    ["an unknown region", "atlantis", "podgorica"],
    ["a real place under the wrong region", "coast", "podgorica"],
  ])(
    "renders the not-found page for %s",
    async (_case, regionId, locationId) => {
      await expect(
        LocationPage(pageProps(regionId, locationId)),
      ).rejects.toThrow("NEXT_NOT_FOUND");

      expect(navigation.notFound).toHaveBeenCalled();
      expect(navigation.redirect).not.toHaveBeenCalled();
    },
  );

  it("sends a locked place back to its region, which says why", async () => {
    await expect(LocationPage(pageProps("coast", "kotor"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(navigation.redirect).toHaveBeenCalledTimes(1);
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/play/coast?notice=location-locked",
    );
  });

  it("sends a place in a locked region back to the map, which says why", async () => {
    serveApi(fetchMock, "new-account");

    await expect(
      LocationPage(pageProps("central", "podgorica")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(navigation.redirect).toHaveBeenCalledTimes(1);
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/play?notice=region-locked",
    );
  });

  it("sends the learner to the region, which offers a retry, when progress failed", async () => {
    serveApi(fetchMock, "failed");

    await expect(
      LocationPage(pageProps("central", "podgorica")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(navigation.redirect).toHaveBeenCalledTimes(1);
    expect(navigation.redirect).toHaveBeenCalledWith("/play/central");
  });

  it("sends a learner whose session ended mid-visit to sign in, then back to the place", async () => {
    serveApi(fetchMock, "signed-out");

    await expect(
      LocationPage(pageProps("central", "podgorica")),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(navigation.redirect).toHaveBeenCalledTimes(1);
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fcentral%2Fpodgorica",
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("lets a failed place reach the error boundary", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorResponse(500, "internal_server_error")),
    );

    await expect(
      LocationPage(pageProps("central", "podgorica")),
    ).rejects.toThrow();
    expect(navigation.notFound).not.toHaveBeenCalled();
    expect(navigation.redirect).not.toHaveBeenCalled();
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage("central", "podgorica");

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("generateMetadata", () => {
  it("titles the page with the place's name", async () => {
    await expect(
      generateMetadata(pageProps("central", "podgorica")),
    ).resolves.toEqual({ title: "Podgorica" });
  });

  it("never gives a locked place's name, redirecting like the page", async () => {
    await expect(generateMetadata(pageProps("coast", "kotor"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(navigation.redirect).toHaveBeenCalledWith(
      "/play/coast?notice=location-locked",
    );
  });

  it("renders the not-found page for a place in another region", async () => {
    await expect(
      generateMetadata(pageProps("coast", "podgorica")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
