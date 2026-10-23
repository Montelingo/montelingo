import { ApiClientError, ApiNetworkError } from "@app/api-client";
import { notFound } from "next/navigation";

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
