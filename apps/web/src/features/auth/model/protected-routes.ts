import { ACCOUNT_PATH, PLAY_PATH, signInHref } from "./routes";

/**
 * The pages that need a signed-in user: each path and everything under it
 * (`/account` and `/account/email`, not `/accounting`). The middleware matcher
 * in `src/middleware.ts` must list each one as `<path>/:path*`; its test fails
 * when the two drift apart.
 */
export const PROTECTED_PATH_PREFIXES: readonly string[] = [
  ACCOUNT_PATH,
  PLAY_PATH,
];

/**
 * True when `pathname` is a protected page. The path is decoded first, because
 * the router decodes it too (`/%61ccount` is `/account`). Matching is
 * case-sensitive, like the router's.
 */
export function isProtectedPath(pathname: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }
  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => decoded === prefix || decoded.startsWith(`${prefix}/`),
  );
}

type SignInRedirectInput = {
  /** The requested path, as the router sees it (`request.nextUrl.pathname`). */
  pathname: string;
  /** The query string with its leading `?`, or `""` (`request.nextUrl.search`). */
  search: string;
  /** Whether the request carries the session cookie at all. */
  hasSessionCookie: boolean;
};

/**
 * The middleware's decision: where to send a request for a protected page
 * that has no session cookie (sign-in, returning to the page with its query
 * string), or `null` to let it through.
 *
 * Only a fast path. A cookie can be stale (expired or revoked), so every
 * protected page still calls `getCurrentUser()` and redirects on `null`.
 */
export function signInRedirectFor({
  pathname,
  search,
  hasSessionCookie,
}: SignInRedirectInput): string | null {
  if (hasSessionCookie || !isProtectedPath(pathname)) {
    return null;
  }
  return signInHref(`${pathname}${search}`);
}
