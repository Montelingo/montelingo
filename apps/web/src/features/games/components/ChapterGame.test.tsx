import { createApiClient } from "@app/api-client";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { endNavigation } from "@/lib/navigation-progress";

import type { MatchWord } from "../model/match";
import { ChapterGame } from "./ChapterGame";
import { RIGHT_DELAY_MS, SETTLE_DELAY_MS } from "./MatchGame";

const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);
vi.mock("@/lib/browser-api", () => ({
  getBrowserApiClient: () =>
    createApiClient({ baseUrl: "http://web.test", fetch: fetchMock }),
}));

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const PLACE_HREF = "/play/coast/budva";
const TEXTS = ["more", "plaža", "pijesak", "sunce"];
const WORDS: MatchWord[] = TEXTS.map((text, index) => ({
  id: `word-${index + 1}`,
  text,
  imageUrl: `/media/words/000${index + 1}.webp`,
}));
// Keeps every round in order, each with its word first (see MatchGame.test).
const NO_SHUFFLE = () => 0.999;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse(status, {
    error: { code, message: code, request_id: "req-1", details: null },
  });
}

function saved(): Response {
  return jsonResponse(200, {
    id: "na-plazi",
    lesson: "done",
    games: [
      { id: "memory", state: "available" },
      { id: "match", state: "completed" },
    ],
  });
}

function resultPosts(gameId: string) {
  const url = `http://web.test/api/v1/chapters/na-plazi/games/${gameId}/result`;
  return fetchMock.mock.calls.filter(
    ([request]) => request.method === "POST" && request.url === url,
  );
}

/** Advances the timers and lets a save's promise settle. */
async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function retryButton() {
  return screen.queryByRole("button", { name: "Pokušaj ponovo" });
}

function getRetryButton() {
  return screen.getByRole("button", { name: "Pokušaj ponovo" });
}

/** Taps the round's right word: an unshuffled round offers it first. */
async function solveRound() {
  const game = screen.getByRole("group", { name: "Spoji riječ i sliku" });
  const [right] = within(game).getAllByRole("button");
  if (right === undefined) {
    throw new Error("no options");
  }
  fireEvent.click(right);
  await wait(RIGHT_DELAY_MS);
}

function bravo() {
  return screen.queryByRole("heading", { name: /^Bravo/ });
}

/** Every round solved, and "Bravo!" settled. */
async function playMatchToBravo() {
  const view = render(
    <ChapterGame
      gameId="match"
      chapterId="na-plazi"
      words={WORDS}
      placeHref={PLACE_HREF}
      random={NO_SHUFFLE}
    />,
  );
  for (let round = 0; round < TEXTS.length; round += 1) {
    await solveRound();
  }
  await wait(SETTLE_DELAY_MS);
  return view;
}

describe("ChapterGame", () => {
  beforeEach(() => {
    // Here, not after each test: unmounting a test's screen refreshes.
    vi.clearAllMocks();
    vi.useFakeTimers();
    fetchMock.mockImplementation(() => Promise.resolve(saved()));
  });

  afterEach(() => {
    endNavigation();
    vi.useRealTimers();
  });

  it("records the game when the child completes it, and refreshes when they leave", async () => {
    const { unmount } = await playMatchToBravo();

    expect(bravo()).toBeVisible();
    expect(resultPosts("match")).toHaveLength(1);
    expect(retryButton()).toBeNull();
    // Not on this screen: a Back that lands mid-way would drop the refresh.
    expect(router.refresh).not.toHaveBeenCalled();

    unmount();

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("records the game once, however often it is played again", async () => {
    await playMatchToBravo();

    fireEvent.click(screen.getByRole("button", { name: "Igraj ponovo" }));
    for (let round = 0; round < TEXTS.length; round += 1) {
      await solveRound();
    }

    expect(bravo()).toBeVisible();
    expect(resultPosts("match")).toHaveLength(1);
  });

  it("keeps a failed save on the Bravo screen, and saves on retry", async () => {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(errorResponse(503, "service_unavailable")),
    );
    const { unmount } = await playMatchToBravo();

    expect(bravo()).toBeVisible();
    expect(
      screen.getByText("Ovo još nije sačuvano.", { selector: "p" }),
    ).toBeVisible();
    expect(router.replace).not.toHaveBeenCalled();

    fireEvent.click(getRetryButton());
    await wait(0);

    expect(resultPosts("match")).toHaveLength(2);
    expect(screen.getByText("Sačuvano!", { selector: "p" })).toBeVisible();
    expect(retryButton()).toBeNull();
    expect(bravo()).toBeVisible();

    unmount();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps offering the retry while it keeps failing", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorResponse(500, "internal_error")),
    );
    await playMatchToBravo();

    fireEvent.click(getRetryButton());
    await wait(0);

    expect(resultPosts("match")).toHaveLength(2);
    expect(retryButton()).not.toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText("Ovo još nije sačuvano.", { selector: "p" }),
    ).toBeVisible();
  });

  it("returns to the place's screen on a 409", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(errorResponse(409, "game_locked")),
    );
    await playMatchToBravo();

    expect(router.replace).toHaveBeenCalledWith(PLACE_HREF);
    expect(retryButton()).toBeNull();
  });

  it("records the memory game under its own id", async () => {
    render(
      <ChapterGame
        gameId="memory"
        chapterId="na-plazi"
        words={WORDS}
        placeHref={PLACE_HREF}
        random={NO_SHUFFLE}
      />,
    );
    // Unshuffled, cards 1 and 2 are a pair, then 3 and 4, and so on.
    const cards = within(
      screen.getByRole("group", { name: "Memorija" }),
    ).getAllByRole("button");
    for (const card of cards) {
      fireEvent.click(card);
    }
    await wait(0);

    expect(resultPosts("memory")).toHaveLength(1);
    expect(resultPosts("match")).toHaveLength(0);
  });
});
