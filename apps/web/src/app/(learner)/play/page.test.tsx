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

const REGIONS = [
  { id: "coast", name: "Obala", location_count: 6 },
  { id: "central", name: "Centralna Crna Gora", location_count: 5 },
  { id: "north", name: "Sjever i planine", location_count: 6 },
];

// A new account: the coast open, the other regions locked.
const NEW_ACCOUNT_PROGRESS = {
  regions: [
    { id: "coast", state: "available" },
    { id: "central", state: "locked" },
    { id: "north", state: "locked" },
  ],
  locations: [{ id: "budva", state: "available" }],
};

function serveApi({ progressStatus = 200 } = {}) {
  fetchMock.mockImplementation((request) => {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/v1/regions") {
      return Promise.resolve(
        jsonResponse(200, {
          items: REGIONS,
          page: { has_more: false, next_cursor: null },
        }),
      );
    }
    if (pathname === "/api/v1/progress") {
      return Promise.resolve(
        progressStatus === 200
          ? jsonResponse(200, NEW_ACCOUNT_PROGRESS)
          : jsonResponse(progressStatus, {
              error: {
                code: "internal_server_error",
                message: "An unexpected error occurred.",
                request_id: "req-1",
                details: null,
              },
            }),
      );
    }
    return Promise.resolve(jsonResponse(404, {}));
  });
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

async function renderPage(searchParams: { notice?: string | string[] } = {}) {
  visit("/play", searchParams);
  return render(
    await PlayPage({ searchParams: Promise.resolve(searchParams) }),
  );
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

describe("PlayPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Your map");
  });

  it("shows the three regions in order, with only the coast open for a new account", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Your map" }),
    ).toBeInTheDocument();
    const cards = within(
      screen.getByRole("list", { name: "Regions" }),
    ).getAllByRole("link");
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Obala, Open",
      "Centralna Crna Gora, Locked",
      "Sjever i planine, Locked",
    ]);
    expect(cards[0]).toHaveAttribute("href", "/play/coast");
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
    serveApi({ progressStatus: 500 });

    await renderPage();

    expect(
      screen.getByRole("link", { name: "Obala, Not loaded" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });

  it("sends a learner whose session ended mid-visit to sign in", async () => {
    serveApi({ progressStatus: 401 });

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
      Promise.resolve(
        jsonResponse(500, {
          error: {
            code: "internal_server_error",
            message: "An unexpected error occurred.",
            request_id: "req-1",
            details: null,
          },
        }),
      ),
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
