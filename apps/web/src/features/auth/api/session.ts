import "server-only";

import { ApiClientError, unwrap } from "@app/api-client";
import { cookies } from "next/headers";
import { cache } from "react";

import { getApiClient } from "@/lib/api";

import type { CurrentUser } from "../model/user";
import { toCurrentUser } from "./current-user";

/**
 * Returns the signed-in user for the current request, or `null` when there is
 * no valid session. Other API failures are thrown to the route's error boundary.
 *
 * Wrapped in React `cache()`, so the layouts and pages of one server render
 * share a single API call. The cache lasts for that render only: route handlers
 * and Server Actions each make their own call. Never call it inside a cached
 * scope (`unstable_cache`, `"use cache"`): the result depends on the user's cookie.
 */
export const getCurrentUser = cache(fetchCurrentUser);

// The API's session cookie (ADR 0004). Without it /auth/me can only answer 401.
const SESSION_COOKIE_NAME = "montelingo_session";

// Exported for tests: React only memoizes cache() inside a server render.
export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  if (!(await cookies()).has(SESSION_COOKIE_NAME)) {
    return null;
  }
  try {
    const user = await unwrap(
      getApiClient({ forwardCookies: true }).GET("/api/v1/auth/me"),
    );
    return toCurrentUser(user);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      return null;
    }
    throw error;
  }
}
