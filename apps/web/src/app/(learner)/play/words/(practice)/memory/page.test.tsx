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

import { serveApi } from "../../../test-api";
import PracticeMemoryPage, { metadata } from "./page";

// The real loader runs, over the fake API in play/test-api.ts. With Podgorica
// open, the child has learned Budva's "Na plaži" and Podgorica's "Povrće i
// ručak", ten pictures each; a new account has learned nothing.
const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);
vi.mock("@/lib/api", () => ({
  getApiClient: (): ApiClient =>
    createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }),
}));

// Practice records each game from the browser (#276), through its own client.
const browserFetch = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);
vi.mock("@/lib/browser-api", () => ({
  getBrowserApiClient: (): ApiClient =>
    createApiClient({ baseUrl: "http://web.test", fetch: browserFetch }),
}));

// Like Next.js, redirect() throws, so nothing after it runs. The save's
// router is a stand-in: the page renders without Next.js's app router.
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  ...navigation,
}));

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.clearAllMocks();
  serveApi(fetchMock, "podgorica-open");
  browserFetch.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ heart_earned: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

async function renderPage() {
  return render(await PracticeMemoryPage());
}

function calledPaths() {
  return fetchMock.mock.calls.map(
    ([request]) => `${request.method} ${new URL(request.url).pathname}`,
  );
}

describe("PracticeMemoryPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Vježbaj: Memory");
  });

  it("deals the memory game from the learned words, and reads no progress", async () => {
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Vježbaj: Memory" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /^karta \d+, licem dolje$/ }),
    ).toHaveLength(12);
    expect(calledPaths().sort()).toEqual([
      "GET /api/v1/profile",
      "GET /api/v1/words",
    ]);
  });

  it("says to learn more words before any lesson, with the way back to Riječi", async () => {
    serveApi(fetchMock, "new-account");

    await renderPage();

    expect(
      screen.getByText("Nauči još riječi pa se vrati!"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Nazad na riječi" }),
    ).toHaveAttribute("href", "/play/words");
  });

  it("says the game did not load when the words failed", async () => {
    serveApi(fetchMock, "failed");

    await renderPage();

    expect(
      screen.getByText(
        "This game didn’t load. Something went wrong on our side.",
      ),
    ).toBeInTheDocument();
  });

  it("sends a learner whose session ended to sign in, then back to the game", async () => {
    serveApi(fetchMock, "signed-out");

    await expect(PracticeMemoryPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(navigation.redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fwords%2Fmemory",
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });
});
