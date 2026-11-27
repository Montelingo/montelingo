import "server-only";

import { ApiClientError, ApiNetworkError, unwrap } from "@app/api-client";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { getApiClient } from "@/lib/api";

import { isSignedOut } from "../errors";
import { toLearnedWords, type WordsResult } from "../model/words";
import { learnedWordsSchema } from "../schemas";

/**
 * The signed-in child's learned words, by place (#232). A failed call returns
 * `{ status: "error" }` and logs it, so the screen still renders, with a
 * retry. A `401` is thrown, as `getProgress()` does, for the loader to send
 * the learner to sign in.
 *
 * Wrapped in React `cache()`, so one server render makes one call.
 */
export const getLearnedWords = cache(fetchLearnedWords);

// Exported for tests: React only memoizes cache() inside a server render.
export async function fetchLearnedWords(): Promise<WordsResult> {
  try {
    const body = await unwrap(
      getApiClient({ forwardCookies: true }).GET("/api/v1/words"),
    );
    return {
      status: "ready",
      words: toLearnedWords(learnedWordsSchema.parse(body)),
    };
  } catch (error) {
    // Next.js signals such as "this route is dynamic" must reach Next.js.
    unstable_rethrow(error);
    if (isSignedOut(error)) {
      throw error;
    }
    let reason = "unexpected";
    let requestId = "";
    if (error instanceof ApiClientError) {
      reason = `status_${error.status}`;
      requestId = error.error.error.request_id;
    } else if (error instanceof ApiNetworkError) {
      reason = "unreachable";
    }
    console.error(
      "words_unavailable reason=%s request_id=%s",
      reason,
      requestId || "-",
      error,
    );
    return { status: "error" };
  }
}
