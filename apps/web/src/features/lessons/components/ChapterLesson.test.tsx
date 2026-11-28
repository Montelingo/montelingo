import { createApiClient } from "@app/api-client";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { endNavigation } from "@/lib/navigation-progress";

import type { LessonWord } from "../model/lesson";
import { ChapterLesson } from "./ChapterLesson";
import { SETTLE_DELAY_MS } from "./LessonCards";

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
const LESSON_URL = "http://web.test/api/v1/chapters/na-plazi/lesson";
const WORDS: LessonWord[] = ["more", "plaža", "pijesak"].map((text, index) => ({
  id: `word-${index + 1}`,
  number: index + 1,
  text,
  imageUrl: null,
  imageUrl512: null,
}));

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

function saved({ heartEarned = false } = {}): Response {
  return jsonResponse(200, {
    id: "na-plazi",
    lesson: "done",
    games: [
      { id: "memory", state: "available" },
      { id: "match", state: "available" },
    ],
    heart_earned: heartEarned,
  });
}

function lessonPosts() {
  return fetchMock.mock.calls.filter(
    ([request]) => request.method === "POST" && request.url === LESSON_URL,
  );
}

function settle() {
  vi.setSystemTime(Date.now() + SETTLE_DELAY_MS);
}

/** Through every card to "Bravo!": the last card records the lesson. */
async function finishLesson() {
  const user = userEvent.setup();
  const { unmount } = render(
    <ChapterLesson chapterId="na-plazi" words={WORDS} placeHref={PLACE_HREF} />,
  );
  settle();
  const next = screen.getByRole("button", { name: "Dalje" });
  for (let card = 0; card < WORDS.length; card += 1) {
    await user.click(next);
  }
  settle();
  return { user, unmount };
}

describe("ChapterLesson", () => {
  beforeEach(() => {
    // Here, not after each test: unmounting a test's screen refreshes.
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    fetchMock.mockImplementation(() => Promise.resolve(saved()));
  });

  afterEach(() => {
    endNavigation();
    vi.useRealTimers();
  });

  it("records the lesson when the child finishes it, once, and refreshes when they leave", async () => {
    const { unmount } = await finishLesson();

    await waitFor(() => expect(lessonPosts()).toHaveLength(1));
    expect(screen.getByRole("heading", { name: "Bravo!" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Pokušaj ponovo" })).toBeNull();

    unmount();

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(lessonPosts()).toHaveLength(1);
  });

  it("shows +1 srce on Bravo when watching it again earned a heart (ADR 0009)", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(saved({ heartEarned: true })),
    );
    await finishLesson();

    expect(await screen.findByText("+1 srce")).toBeVisible();
  });

  it("says nothing about hearts when the save earned none", async () => {
    await finishLesson();
    await waitFor(() => expect(lessonPosts()).toHaveLength(1));

    expect(screen.queryByText(/src/)).toBeNull();
  });

  it("keeps a failed save on the Bravo screen with a calm retry", async () => {
    fetchMock.mockResolvedValueOnce(errorResponse(500, "internal_error"));
    fetchMock.mockResolvedValueOnce(saved());
    const { user } = await finishLesson();

    const retry = await screen.findByRole("button", {
      name: "Pokušaj ponovo",
    });
    expect(
      screen.getByText("Ovo još nije sačuvano.", { selector: "p" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Bravo!" })).toBeVisible();
    expect(router.replace).not.toHaveBeenCalled();

    await user.click(retry);

    expect(
      await screen.findByText("Sačuvano!", { selector: "p" }),
    ).toBeVisible();
    expect(lessonPosts()).toHaveLength(2);
  });

  it("returns to the place's screen on a 409", async () => {
    fetchMock.mockResolvedValue(errorResponse(409, "chapter_locked"));
    await finishLesson();

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(PLACE_HREF),
    );
    expect(screen.queryByRole("button", { name: "Pokušaj ponovo" })).toBeNull();
  });

  it("does not record a lesson the child has not finished", async () => {
    render(
      <ChapterLesson
        chapterId="na-plazi"
        words={WORDS}
        placeHref={PLACE_HREF}
      />,
    );
    await act(async () => {});

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
