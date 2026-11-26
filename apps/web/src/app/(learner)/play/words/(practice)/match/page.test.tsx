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

import { PRACTICE_ROUNDS } from "@/features/games";
import { SETTLE_DELAY_MS } from "@/lib/use-settled";

import { serveApi } from "../../../test-api";
import PracticeMatchPage, { metadata } from "./page";

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

// Like Next.js, redirect() throws, so nothing after it runs.
const navigation = vi.hoisted(() => ({
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof Navigation>()),
  ...navigation,
}));

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.clearAllMocks();
  serveApi(fetchMock, "podgorica-open");
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function renderPage() {
  return render(await PracticeMatchPage());
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function game() {
  return screen.getByRole("group", { name: "Spoji riječ i sliku" });
}

// Taps each round's right word, the picture's name, then lets "Bravo!"
// settle. Returns the words played.
function playToBravo() {
  const played: string[] = [];
  for (let round = 0; round < PRACTICE_ROUNDS; round += 1) {
    const text = within(game()).getByRole("img").getAttribute("aria-label");
    if (text === null) {
      throw new Error("an unnamed picture");
    }
    played.push(text);
    fireEvent.click(within(game()).getByRole("button", { name: text }));
    // The right word shows a moment, then the next round.
    act(() => {
      vi.runOnlyPendingTimers();
    });
  }
  wait(SETTLE_DELAY_MS);
  return played;
}

// The fixture's words are "riječ <number>": Budva's 1–10, Podgorica's 131–140.
function numberOf(text: string): number {
  return Number(text.replace("riječ ", ""));
}

describe("PracticeMatchPage", () => {
  it("is titled", () => {
    expect(metadata.title).toBe("Vježbaj: Spoji riječi");
  });

  it(`plays ${PRACTICE_ROUNDS} rounds, records nothing, and leads back to Riječi`, async () => {
    // Fisher–Yates with just under 1 keeps every item where it is.
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    await renderPage();
    vi.useFakeTimers();

    expect(
      screen.getByRole("heading", { level: 1, name: "Vježbaj: Spoji riječi" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("match-dots").children).toHaveLength(
      PRACTICE_ROUNDS,
    );
    playToBravo();

    expect(screen.getByRole("heading", { name: "Bravo, Mia!" })).toBeVisible();
    expect(screen.getByText("Sve riječi su pronađene!")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Nazad na riječi" }),
    ).toHaveAttribute("href", "/play/words");
    expect(
      fetchMock.mock.calls.filter(([request]) => request.method !== "GET"),
    ).toEqual([]);
    expect(
      fetchMock.mock.calls.map(([request]) => new URL(request.url).pathname),
    ).not.toContain("/api/v1/progress");
  });

  it("deals from every learned place", async () => {
    // A different draw each time, so the rounds mix the places.
    let seed = 42;
    vi.spyOn(Math, "random").mockImplementation(() => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    });
    await renderPage();
    vi.useFakeTimers();

    const played = playToBravo().map(numberOf);

    expect(played.some((number) => number <= 10)).toBe(true);
    expect(played.some((number) => number >= 131)).toBe(true);
  });

  it("deals a new game from all the words on Igraj ponovo", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    await renderPage();
    vi.useFakeTimers();
    playToBravo();

    fireEvent.click(screen.getByRole("button", { name: "Igraj ponovo" }));

    expect(screen.getByTestId("match-dots").children).toHaveLength(
      PRACTICE_ROUNDS,
    );
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

  it("sends a learner whose session ended to sign in, then back to the game", async () => {
    serveApi(fetchMock, "signed-out");

    await expect(PracticeMatchPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(navigation.redirect).toHaveBeenCalledWith(
      "/sign-in?next=%2Fplay%2Fwords%2Fmatch",
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderPage();

    expect(await axe(container)).toHaveNoViolations();
  });
});
