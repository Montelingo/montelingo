import { type ApiClient, createApiClient } from "@app/api-client";
import type * as Navigation from "next/navigation";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

import { spellLetters } from "@/features/games";
import { SETTLE_DELAY_MS } from "@/lib/use-settled";

import { serveApi } from "../../../test-api";
import PracticeSpellPage, { metadata } from "./page";

// The real loader runs, over the fake API in play/test-api.ts. With Podgorica
// open, the child has learned Budva's "Na plaži" (words 1–10) and Podgorica's
// "Povrće i ručak" (131–140) with their pictures, and two chapters without.
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

/**
 * The fixture's words are "riječ 1" and on, and Sastavi riječi leaves out
 * a word with a space: they become "w1" and on, two to four letters each.
 */
function serveSpellableWords() {
  const answer = fetchMock.getMockImplementation();
  if (answer === undefined) {
    throw new Error("serveApi first");
  }
  fetchMock.mockImplementation(async (request) => {
    const response = await answer(request);
    if (new URL(request.url).pathname !== "/api/v1/words") {
      return response;
    }
    const body = (await response.json()) as {
      places: { words: { text: string }[] }[];
    };
    for (const word of body.places.flatMap((place) => place.words)) {
      word.text = word.text.replace("riječ ", "w");
    }
    return new Response(JSON.stringify(body), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  });
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.clearAllMocks();
  serveApi(fetchMock, "podgorica-open");
  serveSpellableWords();
  browserFetch.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ heart_earned: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function renderPage() {
  return render(await PracticeSpellPage());
}

function game() {
  return screen.getByRole("group", { name: "Sastavi riječ za sliku" });
}

/** Spells each word, the picture's name, letter by letter, then lets "Bravo!" settle. */
function playToBravo() {
  for (let round = 0; round < 5; round += 1) {
    const text = within(game()).getByRole("img").getAttribute("aria-label");
    if (text === null) {
      throw new Error("an unnamed picture");
    }
    for (const letter of spellLetters(text)) {
      const tile = within(game())
        .getAllByRole("button", { name: letter })
        .find((button) => button.getAttribute("aria-disabled") === "false");
      if (tile === undefined) {
        throw new Error(`no tile ${letter}`);
      }
      fireEvent.click(tile);
    }
    // The spelled word shows a moment, then the next one.
    act(() => {
      vi.runOnlyPendingTimers();
    });
  }
  act(() => {
    vi.advanceTimersByTime(SETTLE_DELAY_MS);
  });
}

describe("PracticeSpellPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Vježbaj: Sastavi riječi");
  });

  it("plays 5 words, records the game as practice, and leads back to Riječi", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    await renderPage();
    vi.useFakeTimers();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Vježbaj: Sastavi riječi",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("spell-steps").children).toHaveLength(5);
    playToBravo();

    expect(screen.getByRole("heading", { name: "Bravo, Mia!" })).toBeVisible();
    expect(screen.getByText("Sve riječi su složene!")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Nazad na riječi" }),
    ).toHaveAttribute("href", "/play/words");
    expect(
      browserFetch.mock.calls.map(
        ([request]) => `${request.method} ${new URL(request.url).pathname}`,
      ),
    ).toEqual(["POST /api/v1/practice/spell/result"]);
    expect(
      fetchMock.mock.calls.filter(([request]) => request.method !== "GET"),
    ).toEqual([]);
  });

  it("says to learn more words when none can be spelled, with the way back to Riječi", async () => {
    // The fixture's own words all have a space.
    serveApi(fetchMock, "podgorica-open");

    await renderPage();

    expect(
      screen.getByText("Nauči još riječi pa se vrati!"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Nazad na riječi" }),
    ).toHaveAttribute("href", "/play/words");
  });

  it("sends a learner whose session ended to sign in, then back to the game", async () => {
    serveApi(fetchMock, "signed-out");

    await expect(PracticeSpellPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(navigation.redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fwords%2Fspell",
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });
});
