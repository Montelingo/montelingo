import "server-only";

import { ApiClientError, ApiNetworkError, unwrap } from "@app/api-client";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { getApiClient } from "@/lib/api";

import { type ProgressResult, toProgress } from "../model/progress";
import { progressSchema } from "../schemas";

/**
 * The signed-in account's state for every region and location. Never throws
 * for a failed call: it returns `{ status: "error" }` and logs the failure, so
 * the content still renders, with every place in the error state.
 *
 * Wrapped in React `cache()`, so one server render makes one call. Never call
 * it inside a cached scope (`unstable_cache`, `"use cache"`): the result
 * depends on the user's cookie.
 */
export const getProgress = cache(fetchProgress);

// Exported for tests: React only memoizes cache() inside a server render.
export async function fetchProgress(): Promise<ProgressResult> {
  try {
    const body = await unwrap(
      getApiClient({ forwardCookies: true }).GET("/api/v1/progress"),
    );
    return {
      status: "ready",
      progress: toProgress(progressSchema.parse(body)),
    };
  } catch (error) {
    // Next.js signals such as "this route is dynamic" must reach Next.js.
    unstable_rethrow(error);
    logProgressFailure(error);
    return { status: "error" };
  }
}

function logProgressFailure(error: unknown): void {
  let reason = "unexpected";
  let requestId = "";
  if (error instanceof ApiClientError) {
    reason = `status_${error.status}`;
    requestId = error.error.error.request_id;
  } else if (error instanceof ApiNetworkError) {
    reason = "unreachable";
  }
  console.error(
    "map_progress_unavailable reason=%s request_id=%s",
    reason,
    requestId || "-",
    error,
  );
}
