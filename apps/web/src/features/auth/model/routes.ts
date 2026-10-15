import { safeRedirectPath } from "./redirect";

export const HOME_PATH = "/";
export const ACCOUNT_PATH = "/account";
// The learner area: the map, and the regions and places under it.
export const PLAY_PATH = "/play";
export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";

const DEFAULT_REDIRECT_PATH = HOME_PATH;
const PLACEHOLDER_ORIGIN = "https://montelingo.invalid";

// The auth pages, compared lowercased: never a destination after signing in.
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

// Messages the sign-in page shows from its `?notice=`. Only these keys are
// accepted, so a link can never put its own text on the page.
export const SIGN_IN_NOTICES = {
  "password-updated": "Password updated — please sign in.",
} as const;

export type SignInNotice = keyof typeof SIGN_IN_NOTICES;

/** Reads the sign-in page's `?notice=`: a known notice, or `null`. */
export function parseSignInNotice(value: unknown): SignInNotice | null {
  if (typeof value !== "string" || !Object.hasOwn(SIGN_IN_NOTICES, value)) {
    return null;
  }
  return value as SignInNotice;
}

/** Links to the sign-in page showing `notice` above the form. */
export function signInNoticeHref(notice: SignInNotice): string {
  return `${SIGN_IN_PATH}?${new URLSearchParams({ notice }).toString()}`;
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

/**
 * The sign-in page, returning to `next` afterwards. Protected pages and the
 * middleware use it to send a signed-out visitor to sign in.
 */
export function signInHref(next: unknown): string {
  return authPageHref(SIGN_IN_PATH, next);
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
