import { safeRedirectPath } from "./redirect";
import { isPathWithin, PLACEHOLDER_ORIGIN } from "./url-path";

/**
 * The request header in which the middleware hands a protected page's path
 * and query string to the server render. A page can read its own URL, but a
 * layout cannot, so a layout that checks the session reads this header to send
 * a signed-out visitor to sign in and back to the page they asked for.
 */
export const REQUESTED_PATH_HEADER = "x-montelingo-path";

type RequestedUrl = {
  /** The requested path, as the router sees it (`request.nextUrl.pathname`). */
  pathname: string;
  /** The query string with its leading `?`, or `""` (`request.nextUrl.search`). */
  search: string;
};

/**
 * A copy of `headers` with `REQUESTED_PATH_HEADER` set to the requested path
 * and query string. It replaces any value the client sent, so on the paths the
 * middleware runs for, the header always comes from the middleware.
 */
export function withRequestedPath(
  headers: Headers,
  { pathname, search }: RequestedUrl,
): Headers {
  const forwarded = new Headers(headers);
  forwarded.set(REQUESTED_PATH_HEADER, `${pathname}${search}`);
  return forwarded;
}

/**
 * Where to return a signed-out visitor to after signing in, from the value of
 * `REQUESTED_PATH_HEADER`: that path when `safeRedirectPath()` accepts it and
 * it is `section` or under it, otherwise `section` itself. The check keeps a
 * layout from sending anyone elsewhere if the header is ever missing or wrong.
 * It decodes the path as `isProtectedPath()` does, so every path the
 * middleware protects as part of `section` (`/%70lay/kotor`) returns there.
 */
export function requestedPathWithin(
  section: string,
  requestedPath: string | null | undefined,
): string {
  const path = safeRedirectPath(requestedPath, section);
  const { pathname } = new URL(path, PLACEHOLDER_ORIGIN);
  return isPathWithin(pathname, section) ? path : section;
}
