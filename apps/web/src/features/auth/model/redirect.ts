const DEFAULT_REDIRECT_PATH = "/";
const MAX_REDIRECT_PATH_LENGTH = 2048;
// Any origin works: the check is that a path stays on whichever origin it is resolved against.
const PLACEHOLDER_ORIGIN = "https://montelingo.invalid";

/**
 * Returns `next` as a path on this site, or `fallback` when it could send the
 * user anywhere else (open-redirect guard). Takes the raw `?next=` value, so a
 * missing, repeated (array), or non-string parameter falls back too.
 *
 * Only a single-slash absolute path is allowed. Browsers read `//host` and
 * `/\host` as another host and drop tabs and newlines before parsing, so
 * backslashes, control characters, and whitespace are rejected outright. The
 * path is then normalized, and checked again, because dot segments can turn a
 * harmless-looking path into `//host` (`/..//evil.com`). Paths under `/api` are
 * the API proxy, never a page, so they fall back too.
 */
export function safeRedirectPath(
  next: unknown,
  fallback: string = DEFAULT_REDIRECT_PATH,
): string {
  if (
    typeof next !== "string" ||
    next.length > MAX_REDIRECT_PATH_LENGTH ||
    !isSingleSlashPath(next) ||
    /[\\\s\p{Cc}]/u.test(next)
  ) {
    return fallback;
  }

  let url: URL;
  try {
    url = new URL(next, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  // Checked again after normalization, which percent-encodes non-ASCII and can
  // make the path several times longer than the input.
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (
    url.origin !== PLACEHOLDER_ORIGIN ||
    path.length > MAX_REDIRECT_PATH_LENGTH ||
    !isSingleSlashPath(path) ||
    isApiPath(url.pathname)
  ) {
    return fallback;
  }
  return path;
}

function isSingleSlashPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

// Checked on the decoded path, because the router decodes it too (`/%61pi` is `/api`).
function isApiPath(pathname: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  return decoded === "/api" || decoded.startsWith("/api/");
}
