import "server-only";

import { ApiClientError, ApiNetworkError, unwrap } from "@app/api-client";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { getApiClient } from "@/lib/api";

import { type Profile, toProfile } from "../model/profile";
import { profileSchema } from "../schemas";

/**
 * The signed-in account's child profile, or `null` when it cannot be read. A
 * failed call is logged and returns `null`, so the map still renders with its
 * placeholder explorer. The exception is `401`: the learner is signed out, so
 * it is thrown for the caller to send them to sign in.
 *
 * Wrapped in React `cache()`, so one server render makes one call. Never call
 * it inside a cached scope (`unstable_cache`, `"use cache"`): the result
 * depends on the user's cookie.
 */
export const getProfile = cache(fetchProfile);

// Exported for tests: React only memoizes cache() inside a server render.
export async function fetchProfile(): Promise<Profile | null> {
  try {
    const body = await unwrap(
      getApiClient({ forwardCookies: true }).GET("/api/v1/profile"),
    );
    return toProfile(profileSchema.parse(body));
  } catch (error) {
    // Next.js signals such as "this route is dynamic" must reach Next.js.
    unstable_rethrow(error);
    if (error instanceof ApiClientError && error.status === 401) {
      throw error;
    }
    logProfileFailure(error);
    return null;
  }
}

/** What a page gets from `readProfile()`. */
export type ProfileResult =
  | { status: "ready"; profile: Profile }
  /** The call failed (logged); show the placeholder explorer. */
  | { status: "unavailable" }
  /** The session has ended. */
  | { status: "signed-out" };

/**
 * The profile as a typed result, for pages: never throws for a failed call,
 * a `401` included (§5.2). Shares `getProfile()`'s cached call, so a page and
 * the loaders it calls make one request. Next.js signals still pass through.
 */
export async function readProfile(): Promise<ProfileResult> {
  try {
    const profile = await getProfile();
    return profile === null
      ? { status: "unavailable" }
      : { status: "ready", profile };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiClientError && error.status === 401) {
      return { status: "signed-out" };
    }
    throw error;
  }
}

function logProfileFailure(error: unknown): void {
  let reason = "unexpected";
  let requestId = "";
  if (error instanceof ApiClientError) {
    reason = `status_${error.status}`;
    requestId = error.error.error.request_id;
  } else if (error instanceof ApiNetworkError) {
    reason = "unreachable";
  }
  console.error(
    "profile_unavailable reason=%s request_id=%s",
    reason,
    requestId || "-",
    error,
  );
}
