// The API's session cookie (ADR 0004). It is HttpOnly and set and cleared only
// by the API. The web app only checks whether the browser sent it: without it,
// /auth/me can only answer 401, so there is no session to look up.

/** The API's default name (`session_cookie_name` in apps/api/app/core/config.py). */
export const DEFAULT_SESSION_COOKIE_NAME = "montelingo_session";

/** The environment variable the API reads to rename the cookie; the web app reads the same one. */
export const SESSION_COOKIE_NAME_ENV = "MONTELINGO_SESSION_COOKIE_NAME";

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The session cookie's name: `MONTELINGO_SESSION_COOKIE_NAME`, or the API's
 * default when it is unset or blank. Read on every call, at runtime (it is not
 * a `NEXT_PUBLIC_` variable, so the build does not inline it), so one image
 * follows whatever the API was configured with. Both apps must see the same
 * value: the shared `.env` gives it to both in Docker Compose.
 */
export function getSessionCookieName(env: Env = process.env): string {
  const name = env[SESSION_COOKIE_NAME_ENV]?.trim();
  return name ? name : DEFAULT_SESSION_COOKIE_NAME;
}
