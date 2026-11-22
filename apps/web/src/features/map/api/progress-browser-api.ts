import { unwrap } from "@app/api-client";

import { getBrowserApiClient } from "@/lib/browser-api";

import type { GameId } from "../model/progress";

// Recording runs in the browser, through the same-origin proxy, so the API
// sees the real Origin (CSRF check, ADR 0004) and the session cookie, like the
// other mutations. Recording is idempotent (ADR 0006): a second call answers
// `200` and changes nothing, so a retry is always safe.

/** Records the chapter's lesson as seen. Rejects on any failure. */
export async function completeLesson(chapterId: string): Promise<void> {
  await unwrap(
    getBrowserApiClient().POST("/api/v1/chapters/{chapter_id}/lesson", {
      params: { path: { chapter_id: chapterId } },
    }),
  );
}

/** Records the chapter's game as completed. Rejects on any failure. */
export async function completeGame(
  chapterId: string,
  gameId: GameId,
): Promise<void> {
  await unwrap(
    getBrowserApiClient().POST(
      "/api/v1/chapters/{chapter_id}/games/{game_id}/result",
      { params: { path: { chapter_id: chapterId, game_id: gameId } } },
    ),
  );
}
