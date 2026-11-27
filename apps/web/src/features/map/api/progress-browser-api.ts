import { unwrap } from "@app/api-client";

import { getBrowserApiClient } from "@/lib/browser-api";

import type { GameId } from "../model/progress";

// Recording runs in the browser, through the same-origin proxy, so the API
// sees the real Origin (CSRF check, ADR 0004) and the session cookie, like the
// other mutations. Recording is idempotent (ADR 0006): a second call answers
// `200` and changes no state, so a retry is always safe. A replay may earn a
// heart, up to a daily cap, which the answer says (ADR 0009).

/** What recording answered: whether the replay earned a heart. */
export type Recorded = { heartEarned: boolean };

/** Records the chapter's lesson as seen. Rejects on any failure. */
export async function completeLesson(chapterId: string): Promise<Recorded> {
  const result = await unwrap(
    getBrowserApiClient().POST("/api/v1/chapters/{chapter_id}/lesson", {
      params: { path: { chapter_id: chapterId } },
    }),
  );
  return { heartEarned: result.heart_earned };
}

/**
 * Records a practice game from the Riječi tab, played to the end (ADR 0009).
 * Every one is recorded, and may earn a heart. Rejects on any failure.
 */
export async function completePractice(gameId: GameId): Promise<Recorded> {
  const result = await unwrap(
    getBrowserApiClient().POST("/api/v1/practice/{game_id}/result", {
      params: { path: { game_id: gameId } },
    }),
  );
  return { heartEarned: result.heart_earned };
}

/** Records the chapter's game as completed. Rejects on any failure. */
export async function completeGame(
  chapterId: string,
  gameId: GameId,
): Promise<Recorded> {
  const result = await unwrap(
    getBrowserApiClient().POST(
      "/api/v1/chapters/{chapter_id}/games/{game_id}/result",
      { params: { path: { chapter_id: chapterId, game_id: gameId } } },
    ),
  );
  return { heartEarned: result.heart_earned };
}
