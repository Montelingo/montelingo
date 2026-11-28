import "server-only";

import { ApiClientError, ApiNetworkError, unwrap } from "@app/api-client";
import { redirect, unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { signInHref } from "@/features/auth/edge";
import { getApiClient } from "@/lib/api";

import { type Player, PLAYERS_PATH, toPlayer } from "../model/players";
import { playersSchema } from "../schemas";

/**
 * The account's players, oldest first, or `null` when they cannot be read. A
 * failed call is logged and returns `null`, so the Ja tab still renders,
 * without Switch player. The exception is `401`: the learner is signed out,
 * so it is thrown for the caller to send them to sign in.
 *
 * Wrapped in React `cache()`, so one server render makes one call. Never call
 * it inside a cached scope: the result depends on the user's cookie.
 */
export const getPlayers = cache(fetchPlayers);

// Exported for tests: React only memoizes cache() inside a server render.
export async function fetchPlayers(): Promise<readonly Player[] | null> {
  try {
    const body = await unwrap(
      getApiClient({ forwardCookies: true }).GET("/api/v1/players"),
    );
    return playersSchema.parse(body).map(toPlayer);
  } catch (error) {
    // Next.js signals such as "this route is dynamic" must reach Next.js.
    unstable_rethrow(error);
    if (error instanceof ApiClientError && error.status === 401) {
      throw error;
    }
    logPlayersFailure(error);
    return null;
  }
}

/**
 * The "Ko igra?" screen's players. Redirects to sign in, back to the screen,
 * when the session has ended, and throws to the error boundary (which offers
 * a retry) when they cannot be read: there is nothing to pick without them.
 *
 * Call it outside any try/catch: `redirect()` throws.
 */
export async function loadPlayers(): Promise<readonly Player[]> {
  let players: readonly Player[] | null;
  try {
    players = await getPlayers();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiClientError && error.status === 401) {
      redirect(signInHref(PLAYERS_PATH));
    }
    throw error;
  }
  if (players === null) {
    throw new Error("The players could not be read.");
  }
  return players;
}

function logPlayersFailure(error: unknown): void {
  let reason = "unexpected";
  let requestId = "";
  if (error instanceof ApiClientError) {
    reason = `status_${error.status}`;
    requestId = error.error.error.request_id;
  } else if (error instanceof ApiNetworkError) {
    reason = "unreachable";
  }
  console.error(
    "players_unavailable reason=%s request_id=%s",
    reason,
    requestId || "-",
    error,
  );
}
