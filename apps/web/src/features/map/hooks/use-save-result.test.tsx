import { ApiClientError, ApiNetworkError } from "@app/api-client";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { endNavigation } from "@/lib/navigation-progress";

import { type ChapterResult, useSaveResult } from "./use-save-result";

const api = vi.hoisted(() => ({
  completeLesson: vi.fn<(chapterId: string) => Promise<void>>(),
  completeGame: vi.fn<(chapterId: string, gameId: string) => Promise<void>>(),
}));
vi.mock("../api/progress-browser-api", () => api);

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const PLACE_HREF = "/play/coast/budva";
const LESSON: ChapterResult = { kind: "lesson", chapterId: "na-plazi" };
const MATCH: ChapterResult = {
  kind: "game",
  chapterId: "na-plazi",
  gameId: "match",
};

function apiError(status: number, code: string): ApiClientError {
  return new ApiClientError(status, {
    error: { code, message: code, request_id: "req-1", details: null },
  });
}

function renderSave(result: ChapterResult = LESSON) {
  return renderHook(() => useSaveResult(result, PLACE_HREF));
}

/** Calls `fn`, then lets the save's promise settle. */
async function run(fn: () => void) {
  await act(async () => {
    fn();
    await Promise.resolve();
  });
}

describe("useSaveResult", () => {
  beforeEach(() => {
    // Here, not after each test: unmounting a test's hook after it refreshes.
    vi.clearAllMocks();
    api.completeLesson.mockResolvedValue(undefined);
    api.completeGame.mockResolvedValue(undefined);
  });

  afterEach(() => {
    endNavigation();
  });

  it("records the lesson once, however often save is called", async () => {
    const { result } = renderSave();
    expect(result.current.status).toBe("idle");

    await run(() => {
      result.current.save();
      result.current.save();
    });
    await run(() => result.current.save());

    expect(api.completeLesson).toHaveBeenCalledTimes(1);
    expect(api.completeLesson).toHaveBeenCalledWith("na-plazi");
    expect(api.completeGame).not.toHaveBeenCalled();
  });

  it("records the game with its chapter and game ids", async () => {
    const { result } = renderSave(MATCH);

    await run(() => result.current.save());

    expect(api.completeGame).toHaveBeenCalledWith("na-plazi", "match");
    expect(api.completeLesson).not.toHaveBeenCalled();
  });

  it("refreshes the router when the child leaves after the save, not before", async () => {
    const { result, unmount } = renderSave();

    await run(() => result.current.save());

    expect(result.current.status).toBe("saved");
    expect(result.current.hasFailed).toBe(false);
    // A refresh on this screen would be dropped by a Back that lands mid-way.
    expect(router.refresh).not.toHaveBeenCalled();

    unmount();

    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("refreshes as soon as it saves when the child left while it was saving", async () => {
    let finish = () => {};
    api.completeLesson.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result, unmount } = renderSave();
    await run(() => result.current.save());
    unmount();
    expect(router.refresh).not.toHaveBeenCalled();

    await act(async () => {
      finish();
      await Promise.resolve();
    });

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh when the child leaves before a save", () => {
    const { unmount } = renderSave();

    unmount();

    expect(router.refresh).not.toHaveBeenCalled();
  });

  it.each([
    ["a server error", apiError(500, "internal_error")],
    [
      "no connection",
      new ApiNetworkError({ cause: new TypeError("fetch failed") }),
    ],
  ])("keeps the child where they are after %s", async (_, error) => {
    api.completeLesson.mockRejectedValue(error);
    const { result } = renderSave();

    await run(() => result.current.save());

    expect(result.current.status).toBe("failed");
    expect(result.current.hasFailed).toBe(true);
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("saves again on retry after a failure", async () => {
    api.completeGame.mockRejectedValueOnce(apiError(500, "internal_error"));
    const { result, unmount } = renderSave(MATCH);
    await run(() => result.current.save());

    await run(() => result.current.retry());

    expect(api.completeGame).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("saved");
    // The notice stays, to say it saved.
    expect(result.current.hasFailed).toBe(true);
    unmount();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not refresh when the child leaves with the save still failed", async () => {
    api.completeLesson.mockRejectedValue(apiError(500, "internal_error"));
    const { result, unmount } = renderSave();
    await run(() => result.current.save());

    unmount();

    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("ignores retry before a failure, after a save, and while one runs", async () => {
    const { result } = renderSave();
    await run(() => result.current.retry());
    expect(api.completeLesson).not.toHaveBeenCalled();

    api.completeLesson.mockRejectedValueOnce(apiError(500, "internal_error"));
    await run(() => result.current.save());
    let finish = () => {};
    api.completeLesson.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await run(() => {
      result.current.retry();
      result.current.retry();
    });
    expect(result.current.status).toBe("saving");
    await run(() => finish());
    await run(() => result.current.retry());

    expect(api.completeLesson).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["chapter_locked", LESSON],
    ["game_locked", MATCH],
  ] as const)(
    "goes back to the place's screen on a 409 %s",
    async (code, saved) => {
      api.completeLesson.mockRejectedValue(apiError(409, code));
      api.completeGame.mockRejectedValue(apiError(409, code));
      const { result } = renderSave(saved);

      await run(() => result.current.save());

      expect(router.replace).toHaveBeenCalledWith(PLACE_HREF);
      expect(result.current.hasFailed).toBe(false);
      expect(router.refresh).not.toHaveBeenCalled();
    },
  );

  it("sends a signed-out child to sign in, then back to the place", async () => {
    api.completeLesson.mockRejectedValue(apiError(401, "unauthenticated"));
    const { result } = renderSave();

    await run(() => result.current.save());

    expect(router.replace).toHaveBeenCalledWith(
      `/sign-in?next=${encodeURIComponent(PLACE_HREF)}`,
    );
    expect(result.current.hasFailed).toBe(false);
  });

  it("does not move a child who has already left the screen", async () => {
    let fail: (error: unknown) => void = () => {};
    api.completeLesson.mockReturnValue(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    const { result, unmount } = renderSave();
    await run(() => result.current.save());
    unmount();

    await act(async () => {
      fail(apiError(409, "chapter_locked"));
      await Promise.resolve();
    });

    expect(router.replace).not.toHaveBeenCalled();
  });
});
