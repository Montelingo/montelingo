import "server-only";

import { ApiClientError, ApiNetworkError, unwrap } from "@app/api-client";
import { cookies } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { getApiClient } from "@/lib/api";

import { getSessionCookieName } from "../model/session-cookie";
import type { AuthState, CurrentUser } from "../model/user";
import { toCurrentUser } from "./current-user";

/**
 * Returns the signed-in user for the current request, or `null` when there is
 * no valid session. Other API failures are thrown to the route's error boundary.
 * Protected pages use it: a failure must not look like "signed out".
 *
 * Wrapped in React `cache()`, so the layouts and pages of one server render
 * share a single API call. The cache lasts for that render only: route handlers
 * and Server Actions each make their own call. Never call it inside a cached
 * scope (`unstable_cache`, `"use cache"`): the result depends on the user's cookie.
 */
export const getCurrentUser = cache(fetchCurrentUser);

/**
 * Like `getCurrentUser()`, but never throws for a failed lookup: it returns
 * `{ status: "unavailable" }` and logs the failure. For UI that must render
 * whatever happens (the site header, in the (site) layout) and for pages where
 * an unknown user can be treated as signed out (sign-in, sign-up).
 *
 * Shares `getCurrentUser()`'s call, and is cached itself so a failure is
 * logged once per request.
 */
export const getAuthState = cache(resolveAuthState);

// Bounds the lookup, so an API that accepts the connection but never answers
// cannot hold a protected page, or the header's account controls, for long.
// /auth/me is one indexed read; anything slower is treated as an outage.
export const CURRENT_USER_TIMEOUT_MS = 3_000;

// Exported for tests: React only memoizes cache() inside a server render.
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  if (!(await cookies()).has(getSessionCookieName())) {
    return null;
  }
  try {
    const user = await unwrap(
      getApiClient({ forwardCookies: true }).GET("/api/v1/auth/me", {
        signal: AbortSignal.timeout(CURRENT_USER_TIMEOUT_MS),
      }),
    );
    return toCurrentUser(user);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

// Exported for tests, like fetchCurrentUser.
export async function resolveAuthState(): Promise<AuthState> {
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    // Next.js signals such as "this route is dynamic" (cookies() during a
    // static render) are thrown too, and must reach Next.js.
    unstable_rethrow(error);
    logLookupFailure(error);
    return { status: "unavailable" };
  }
  return user === null
    ? { status: "signed-out" }
    : { status: "signed-in", user };
}

function logLookupFailure(error: unknown): void {
  let reason = "unexpected";
  let requestId = "";
  if (error instanceof ApiClientError) {
    reason = `status_${error.status}`;
    requestId = error.error.error.request_id;
  } else if (error instanceof ApiNetworkError) {
    reason = isTimeout(error.cause) ? "timeout" : "unreachable";
  } else if (isTimeout(error)) {
    // The timeout fired after the headers arrived, while the body was read:
    // that read rejects with the signal's reason as is.
    reason = "timeout";
  }
  console.error(
    "auth_current_user_unavailable reason=%s request_id=%s",
    reason,
    requestId || "-",
    error,
  );
}

// AbortSignal.timeout() aborts with a "TimeoutError" DOMException; some
// runtimes report an aborted body read as "AbortError". The lookup's only
// signal is the timeout, so both mean it ran out of time.
function isTimeout(error: unknown): boolean {
  return (
    (error instanceof Error || error instanceof DOMException) &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}
