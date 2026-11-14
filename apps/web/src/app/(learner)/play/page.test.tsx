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

import PlayPage, { metadata } from "./page";
import { errorResponse, serveApi } from "./test-api";

// The real loaders run, over a fake API.
const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);
vi.mock("@/lib/api", () => ({
  getApiClient: (): ApiClient =>
    createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
}));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => window.location.pathname,
  // The URL as it is now, like Next.js, whose router follows
  // history.replaceState().
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

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

async function renderPage(searchParams: { notice?: string | string[] } = {}) {
  visit("/play", searchParams);
  return render(
    await PlayPage({ searchParams: Promise.resolve(searchParams) }),
  );
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

describe("PlayPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Mapa");
  });

  it("shows the three regions in order, with only the coast open for a new account", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Mapa" }),
    ).toBeInTheDocument();
    const regions = within(
      screen.getByRole("group", { name: "Mapa Crne Gore" }),
    ).getAllByRole("link");
    expect(regions.map((link) => link.getAttribute("aria-label"))).toEqual([
      "Obala, otvoreno",
      "Centralna Crna Gora, zaključano",
      "Sjever i planine, zaključano",
    ]);
    expect(regions[0]).toHaveAttribute("href", "/play/coast");
  });

  it("says why the learner was sent back from a locked region", async () => {
    await renderPage({ notice: "region-locked" });

    expect(
      screen.getByText(
        "That region isn’t open yet. Keep exploring the open places to reach it.",
      ),
    ).toBeVisible();
  });

  it.each<[string, string | string[]]>([
    ["an unknown notice", "account-deleted"],
    ["free text", "Your account is locked"],
    ["a repeated parameter", ["region-locked", "region-locked"]],
  ])("shows no notice for %s", async (_case, notice) => {
    await renderPage({ notice });

    expect(screen.queryByText(/isn’t open yet/)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Your account is locked"),
    ).not.toBeInTheDocument();
  });

  it("still shows the regions when progress fails, with a retry", async () => {
    serveApi(fetchMock, "failed");

    await renderPage();

    expect(
      screen.getByRole("link", { name: "Obala, nije učitano" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("sends a learner whose session ended mid-visit to sign in", async () => {
    serveApi(fetchMock, "signed-out");

    // The real redirect(): sign-in returns to the map by default.
    await expect(
      PlayPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining(";/sign-in;") as unknown,
    });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("lets a failed region list reach the error boundary", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorResponse(500, "internal_server_error")),
    );

    await expect(
      PlayPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow();
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage({ notice: "region-locked" });

    expect(await axe(container)).toHaveNoViolations();
  });
});
