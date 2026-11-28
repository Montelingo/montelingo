import { ApiClientError, createApiClient } from "@app/api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  completeGame,
  completeLesson,
  completePractice,
} from "./progress-browser-api";

const fetchMock = vi.hoisted(() =>
  vi.fn<(request: Request) => Promise<Response>>(),
);

vi.mock("@/lib/browser-api", () => ({
  getBrowserApiClient: () =>
    createApiClient({ baseUrl: "http://web.test", fetch: fetchMock }),
}));

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse(status, {
    error: { code, message: code, request_id: `req-${code}`, details: null },
  });
}

const CHAPTER_RESULT = {
  id: "na-plazi",
  lesson: "done",
  games: [
    { id: "memory", state: "available" },
    { id: "match", state: "available" },
  ],
  heart_earned: false,
};

function lastRequest(): Request {
  const request = fetchMock.mock.calls.at(-1)?.[0];
  if (request === undefined) {
    throw new Error("no request");
  }
  return request;
}

describe("progress browser API", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse(200, CHAPTER_RESULT));
  });

  it("records the lesson with POST /chapters/{id}/lesson", async () => {
    await completeLesson("na-plazi");

    const request = lastRequest();
    expect(request.method).toBe("POST");
    expect(request.url).toBe("http://web.test/api/v1/chapters/na-plazi/lesson");
  });

  it.each(["memory", "match"] as const)(
    "records the %s game with POST /chapters/{id}/games/{game}/result",
    async (gameId) => {
      await completeGame("na-plazi", gameId);

      const request = lastRequest();
      expect(request.method).toBe("POST");
      expect(request.url).toBe(
        `http://web.test/api/v1/chapters/na-plazi/games/${gameId}/result`,
      );
    },
  );

  it("says whether a replay earned a heart (ADR 0009)", async () => {
    await expect(completeLesson("na-plazi")).resolves.toEqual({
      heartEarned: false,
    });

    // A new response each call: a body can be read only once.
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse(200, { ...CHAPTER_RESULT, heart_earned: true }),
      ),
    );

    await expect(completeLesson("na-plazi")).resolves.toEqual({
      heartEarned: true,
    });
    await expect(completeGame("na-plazi", "memory")).resolves.toEqual({
      heartEarned: true,
    });
  });

  it.each(["memory", "match"] as const)(
    "records a practice %s game with POST /practice/{game}/result, and says whether it earned a heart",
    async (gameId) => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(jsonResponse(200, { heart_earned: true })),
      );

      await expect(completePractice(gameId)).resolves.toEqual({
        heartEarned: true,
      });

      const request = lastRequest();
      expect(request.method).toBe("POST");
      expect(request.url).toBe(
        `http://web.test/api/v1/practice/${gameId}/result`,
      );
    },
  );

  it("rejects with the API's error, so a 409 can be told apart", async () => {
    fetchMock.mockResolvedValue(errorResponse(409, "game_locked"));

    const error = await completeGame("na-plazi", "match").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).status).toBe(409);
  });
});
