import { ApiClientError, ApiNetworkError } from "@app/api-client";
import { notFound, redirect } from "next/navigation";

import { signInHref } from "@/features/auth/edge";

// Server-side only in practice: exported from ./server, not ./index, because it
// pulls in the API client. A client `error.tsx` cannot use it either: in
// production the error it receives is a sanitized copy, not the ApiClientError.

export const mapErrorMessages = {
  unreachable:
    "We couldn’t reach Montelingo. Check your connection and try again.",
  generic: "This page didn’t open. Try again.",
};

/**
 * Calls Next's `notFound()` when the API answered `content_not_found` (an
 * unknown region or location id), so the nearest `not-found.tsx` renders.
 * Returns for every other error.
 */
export function notFoundOnMissingContent(error: unknown): void {
  if (
    error instanceof ApiClientError &&
    error.error.error.code === "content_not_found"
  ) {
    notFound();
  }
}

/**
 * True when the API answered `401`: the session ended, so the learner is
 * signed out. `play/layout.tsx` checks the session on full loads only, so a
 * session that ends mid-visit shows up here, on a page's own data request.
 */
export function isSignedOut(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}

/**
 * Calls Next's `redirect()` to the sign-in page when the API answered `401`,
 * returning to `returnTo` after signing in. Returns for every other error, so
 * the caller rethrows it: a `catch` that ends here must never swallow one.
 */
export function redirectOnSignedOut(error: unknown, returnTo: string): void {
  if (isSignedOut(error)) {
    redirect(signInHref(returnTo));
  }
}

/**
 * Turns an error from a map call into copy that is safe to show: never the
 * API's `message`. `content_not_found` becomes `notFound()` instead.
 */
export function toMapErrorMessage(error: unknown): string {
  notFoundOnMissingContent(error);
  if (
    error instanceof ApiNetworkError ||
    (error instanceof ApiClientError &&
      error.error.error.code === "service_unavailable")
  ) {
    return mapErrorMessages.unreachable;
  }
  return mapErrorMessages.generic;
}
