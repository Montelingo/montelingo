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
let cachedBase: { raw: string; base: ApiBase } | undefined;

/**
 * Returns the API base that server code (SSR and the `/api/*` proxy) uses over
 * the internal network. It reads API_INTERNAL_BASE_URL on every call, so one
 * build can target any API, and throws when the value is invalid.
 */
export function getApiInternalBase(): ApiBase {
  const configured = process.env.API_INTERNAL_BASE_URL?.trim();
  const raw = configured ? configured : DEFAULT_API_INTERNAL_BASE_URL;
  if (cachedBase?.raw !== raw) {
    cachedBase = { raw, base: Object.freeze(parseApiBase(raw)) };
  }
  return cachedBase.base;
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

// More proxies than this in front of the web is a typo, not a deployment.
const MAX_TRUSTED_PROXY_HOPS = 10;

// The last parsed value, reused while TRUSTED_PROXY_HOPS is unchanged. Invalid
// values throw before reaching it.
let cachedHops: { raw: string; hops: number } | undefined;

/**
 * Returns how many trusted proxies (the TLS-terminating edge, a load balancer,
 * a CDN) sit in front of the web server, each appending its peer's address to
 * X-Forwarded-For. The `/api/*` proxy takes the client IP from that position.
 * It reads TRUSTED_PROXY_HOPS on every call, defaults to 0 (the web is reached
 * directly, so the header is never trusted), and throws when the value is not
 * an integer from 0 to 10.
 */
export function getTrustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS?.trim() ?? "";
  if (cachedHops?.raw !== raw) {
    cachedHops = { raw, hops: parseTrustedProxyHops(raw) };
  }
  return cachedHops.hops;
}

function parseTrustedProxyHops(raw: string): number {
  if (raw === "") {
    return 0;
  }
  if (!/^\d+$/.test(raw) || Number(raw) > MAX_TRUSTED_PROXY_HOPS) {
    throw new Error(
      `TRUSTED_PROXY_HOPS must be an integer from 0 to ${MAX_TRUSTED_PROXY_HOPS}, got "${raw}".`,
    );
  }
  return Number(raw);
}
