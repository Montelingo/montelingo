import { safeRedirectPath } from "./redirect";

export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";

const DEFAULT_REDIRECT_PATH = "/";
const PLACEHOLDER_ORIGIN = "https://montelingo.invalid";

// The pages a signed-in user is sent away from, compared lowercased.
const AUTH_PAGE_PATHS: ReadonlySet<string> = new Set(
  [SIGN_IN_PATH, SIGN_UP_PATH, FORGOT_PASSWORD_PATH, RESET_PASSWORD_PATH].map(
    (path) => path.toLowerCase(),
  ),
);

/**
 * Where to send the user once they are signed in: `next` when
 * `safeRedirectPath()` accepts it and it is not an auth page, otherwise `/`.
 * An auth page would only redirect a signed-in user again, dropping the rest
 * of the `next` chain.
 */
export function postAuthRedirectPath(next: unknown): string {
  const path = safeRedirectPath(next, DEFAULT_REDIRECT_PATH);
  return isAuthPagePath(path) ? DEFAULT_REDIRECT_PATH : path;
}

/**
 * Links to an auth page, carrying where to go after signing in as `?next=`.
 * `next` is checked with `postAuthRedirectPath()` first, and the parameter is
 * left out when it is missing, unsafe, an auth page, or the default.
 */
export function authPageHref(page: string, next: unknown): string {
  const redirectTo = postAuthRedirectPath(next);
  if (redirectTo === DEFAULT_REDIRECT_PATH) {
    return page;
  }
  return `${page}?${new URLSearchParams({ next: redirectTo }).toString()}`;
}

// Matches the way a request could still reach an auth page: percent-encoded
// (`/%73ign-in`, decoded by the router), with trailing slashes (redirected
// to the bare path), or in another case (treated the same, to be safe).
function isAuthPagePath(path: string): boolean {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(path, PLACEHOLDER_ORIGIN).pathname);
  } catch {
    return true;
  }
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  return AUTH_PAGE_PATHS.has(trimmed.toLowerCase());
}
