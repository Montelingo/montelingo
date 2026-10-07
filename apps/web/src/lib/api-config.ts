import "server-only";

// The API address for local `pnpm dev`. Containers set API_INTERNAL_BASE_URL.
export const DEFAULT_API_INTERNAL_BASE_URL = "http://localhost:8000";

/** The API's internal origin, and its path prefix without a trailing slash ("" when none). */
export type ApiBase = {
  origin: string;
  path: string;
};

// The last parsed value, reused while API_INTERNAL_BASE_URL is unchanged. It is
// frozen because callers share it. Invalid values throw before reaching it.
let cached: { raw: string; base: ApiBase } | undefined;

/**
 * Returns the API base that server code (SSR and the `/api/*` proxy) uses over
 * the internal network. It reads API_INTERNAL_BASE_URL on every call, so one
 * build can target any API, and throws when the value is invalid.
 */
export function getApiInternalBase(): ApiBase {
  const configured = process.env.API_INTERNAL_BASE_URL?.trim();
  const raw = configured ? configured : DEFAULT_API_INTERNAL_BASE_URL;
  if (cached?.raw !== raw) {
    cached = { raw, base: Object.freeze(parseApiBase(raw)) };
  }
  return cached.base;
}

/** The API base as a URL string, without a trailing slash. */
export function getApiInternalBaseUrl(): string {
  const { origin, path } = getApiInternalBase();
  return `${origin}${path}`;
}

function parseApiBase(raw: string): ApiBase {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `API_INTERNAL_BASE_URL must be an absolute http(s) URL, got "${raw}".`,
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `API_INTERNAL_BASE_URL must use http or https, got "${url.protocol}".`,
    );
  }
  if (
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error(
      "API_INTERNAL_BASE_URL must not contain credentials, a query string, or a fragment.",
    );
  }
  return { origin: url.origin, path: url.pathname.replace(/\/+$/, "") };
}
