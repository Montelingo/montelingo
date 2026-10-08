import { isIP } from "node:net";

import type { ErrorEnvelope } from "@app/api-client";

import {
  type ApiBase,
  getApiInternalBase,
  getTrustedProxyHops,
} from "@/lib/api-config";

// How long the proxy waits for the API's response headers, counted from when
// the request body has been read. A response body that is still streaming
// after that is not cut off.
export const API_PROXY_TIMEOUT_MS = 30_000;
// API payloads are small JSON documents. Larger request bodies get a 413.
export const API_PROXY_MAX_BODY_BYTES = 1_048_576;

type ProxyApiRequestOptions = {
  /** Resolves the API base, and throws when it is misconfigured. */
  getBase?: () => ApiBase;
  /** Resolves TRUSTED_PROXY_HOPS, and throws when it is misconfigured. */
  getTrustedProxyHops?: () => number;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

// The codes the proxy answers with, a subset of ErrorCode in
// apps/api/app/core/errors.py.
type ProxyErrorCode =
  | "not_found"
  | "bad_request"
  | "internal_server_error"
  | "service_unavailable";

// The only request headers the API receives, besides the X-Forwarded-For the
// proxy sets itself. Referer backs up Origin in the API's CSRF check. The If-*
// headers let the API answer 304. The client's X-Forwarded-* is dropped
// because clients can spoof it. Authorization is dropped because auth is the
// session cookie only (ADR 0004).
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "cookie",
  "if-modified-since",
  "if-none-match",
  "origin",
  "referer",
  "user-agent",
] as const;

// Hop-by-hop headers (RFC 9110 §7.6.1) describe a single connection. fetch
// decompresses the body but keeps Content-Encoding and Content-Length, which
// then describe the wrong bytes.
const STRIPPED_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
]);

const NULL_BODY_STATUSES = new Set([204, 205, 304]);

const FORWARDED_FOR_HEADER = "x-forwarded-for";
const REQUEST_ID_HEADER = "x-request-id";
// Same rule as apps/api/app/core/request_id.py.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Forwards a same-origin `/api/*` request to the API and streams the answer
 * back. Failures the proxy itself detects come back as the API's error
 * envelope, so `unwrap()` handles them like any API error.
 */
export async function proxyApiRequest(
  request: Request,
  {
    getBase = getApiInternalBase,
    getTrustedProxyHops: getHops = getTrustedProxyHops,
    fetch: fetchUpstream = fetch,
    timeoutMs = API_PROXY_TIMEOUT_MS,
  }: ProxyApiRequestOptions = {},
): Promise<Response> {
  const requestId = resolveRequestId(request.headers);
  const fail = (status: number, code: ProxyErrorCode, message: string) =>
    errorResponse(status, code, message, requestId);
  // A client that disconnected never reads the response, and is not an API
  // failure, so it is not logged.
  const cancelled = () =>
    fail(502, "service_unavailable", "The request was cancelled.");

  let base: ApiBase;
  let trustedProxyHops: number;
  try {
    base = getBase();
    trustedProxyHops = getHops();
  } catch (error) {
    // A bad API_INTERNAL_BASE_URL or TRUSTED_PROXY_HOPS is a deployment fault.
    // Log the details and answer with the error envelope instead of Next's
    // HTML error page.
    console.error(
      "api_proxy_config_error method=%s path=%s request_id=%s",
      request.method,
      new URL(request.url).pathname,
      requestId,
      error,
    );
    return fail(500, "internal_server_error", "An unexpected error occurred.");
  }

  const target = resolveTargetUrl(request.url, base);
  if (target === null) {
    return fail(404, "not_found", "Resource not found.");
  }

  let body: RequestBody;
  try {
    body = await readBody(request);
  } catch {
    if (request.signal.aborted) {
      return cancelled();
    }
    return fail(400, "bad_request", "The request body could not be read.");
  }
  if (body === TOO_LARGE) {
    return fail(413, "bad_request", "The request body is too large.");
  }

  // request.signal stays attached to the upstream call, so a client that
  // disconnects also cancels a response body still streaming.
  const timeout = new AbortController();
  const timer = setTimeout(() => {
    timeout.abort(new DOMException("The API timed out.", "TimeoutError"));
  }, timeoutMs);
  let upstream: Response;
  try {
    upstream = await fetchUpstream(target, {
      method: request.method,
      headers: buildUpstreamHeaders(
        request.headers,
        requestId,
        resolveClientIp(
          request.headers.get(FORWARDED_FOR_HEADER),
          trustedProxyHops,
        ),
      ),
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.any([request.signal, timeout.signal]),
    });
  } catch (error) {
    if (request.signal.aborted) {
      return cancelled();
    }
    const isTimeout = timeout.signal.aborted;
    console.error(
      "api_proxy_upstream_error reason=%s method=%s path=%s request_id=%s",
      isTimeout ? "timeout" : "unreachable",
      request.method,
      target.pathname,
      requestId,
      error,
    );
    return fail(
      isTimeout ? 504 : 502,
      "service_unavailable",
      isTimeout
        ? "The API did not respond in time."
        : "The API is unavailable.",
    );
  } finally {
    clearTimeout(timer);
  }

  return toDownstreamResponse(
    upstream,
    request.method,
    target,
    base,
    requestId,
  );
}

/**
 * Returns the request's X-Request-Id when it matches the API's format, and a
 * new UUID otherwise.
 */
function resolveRequestId(headers: Headers): string {
  const value = headers.get(REQUEST_ID_HEADER)?.trim();
  return value && SAFE_REQUEST_ID.test(value) ? value : crypto.randomUUID();
}

// Built from the raw request URL, never from decoded route params, and
// appended to the base rather than resolved against it, so the base's path
// prefix survives and nothing can climb out of `<prefix>/api/`.
function resolveTargetUrl(requestUrl: string, base: ApiBase): URL | null {
  const { pathname, search } = new URL(requestUrl);
  if (!hasSafeSegments(pathname)) {
    return null;
  }
  const target = new URL(`${base.origin}${base.path}${pathname}${search}`);
  const apiPrefix = `${base.path}/api/`;
  if (
    !target.pathname.startsWith(apiPrefix) ||
    target.pathname.length === apiPrefix.length
  ) {
    return null;
  }
  return target;
}

// URL parsing already resolves dot segments (`..`, `%2e%2e`) and turns `\`
// into `/`. Segments that only contain a separator after decoding (`..%2f`,
// `%5c`) are refused, so the API cannot route them somewhere else.
function hasSafeSegments(pathname: string): boolean {
  return pathname.split("/").every((segment) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return false;
    }
    return !decoded.includes("/") && !decoded.includes("\\");
  });
}

/**
 * Returns the client IP that the trusted proxies in front of the web recorded
 * in X-Forwarded-For, or null when there is none to trust. Each trusted proxy
 * appends its peer's address, so the client's address is `hops` entries from
 * the right, and everything left of it is whatever the client sent.
 */
function resolveClientIp(
  forwardedFor: string | null,
  hops: number,
): string | null {
  // With no trusted proxy the header is the client's own, or the socket
  // address Next fills in only when the client sent none.
  if (hops === 0 || forwardedFor === null) {
    return null;
  }
  const entries = forwardedFor.split(",");
  // Fewer entries than trusted proxies means the request skipped the chain.
  if (entries.length < hops) {
    return null;
  }
  const entry = entries[entries.length - hops];
  return entry === undefined ? null : normalizeIp(entry.trim());
}

// Proxies write `[v6]`, `[v6]:port`, or `v4:port` as well as bare addresses,
// and IPv4 clients of a dual-stack socket as `::ffff:a.b.c.d`. Every spelling
// of one address becomes the same string, so one client is one rate-limit key.
function normalizeIp(value: string): string | null {
  const bracketed = /^\[([^\]]*)\](?::\d+)?$/.exec(value);
  const address = bracketed?.[1] ?? value.replace(/^([\d.]+):\d+$/, "$1");
  const version = isIP(address);
  if (version === 4) {
    return address;
  }
  if (version !== 6) {
    return null;
  }
  // URL parsing gives the canonical IPv6 text (lowercase, zeros compressed,
  // embedded IPv4 in hex). It rejects zone IDs (`fe80::1%eth0`).
  const hostname = URL.parse(`http://[${address}]`)?.hostname;
  if (hostname === undefined) {
    return null;
  }
  const canonical = hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
  if (mapped === null) {
    return canonical;
  }
  const high = Number.parseInt(mapped[1] ?? "", 16);
  const low = Number.parseInt(mapped[2] ?? "", 16);
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

// The client's X-Forwarded-For never passes through. The API gets exactly the
// resolved client IP, or no header at all.
function buildUpstreamHeaders(
  incoming: Headers,
  requestId: string,
  clientIp: string | null,
): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }
  if (clientIp !== null) {
    headers.set(FORWARDED_FOR_HEADER, clientIp);
  }
  headers.set(REQUEST_ID_HEADER, requestId);
  return headers;
}

const TOO_LARGE = Symbol("too large");

type RequestBody = Uint8Array | Blob | undefined | typeof TOO_LARGE;

// Buffering keeps a real Content-Length and avoids streaming request bodies
// through fetch. Bytes are counted as they arrive, because a chunked body has
// no Content-Length and a declared one can be wrong.
async function readBody(request: Request): Promise<RequestBody> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > API_PROXY_MAX_BODY_BYTES) {
    return TOO_LARGE;
  }
  if (request.body === null) {
    return undefined;
  }

  request.signal.throwIfAborted();
  const reader = request.body.getReader();
  // A client that disconnects mid-upload ends the read instead of leaving it
  // waiting for bytes that never come.
  const stopReading = () => void reader.cancel();
  request.signal.addEventListener("abort", stopReading, { once: true });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      length += value.byteLength;
      if (length > API_PROXY_MAX_BODY_BYTES) {
        await reader.cancel();
        return TOO_LARGE;
      }
      chunks.push(value);
    }
  } finally {
    request.signal.removeEventListener("abort", stopReading);
  }
  request.signal.throwIfAborted();
  if (length === 0) {
    return undefined;
  }
  return chunks.length === 1 ? chunks[0] : new Blob(chunks);
}

async function toDownstreamResponse(
  upstream: Response,
  method: string,
  target: URL,
  base: ApiBase,
  requestId: string,
): Promise<Response> {
  const connectionHeaders = new Set(
    (upstream.headers.get("connection") ?? "")
      .split(",")
      .map((name) => name.trim().toLowerCase()),
  );
  const headers = new Headers();
  // forEach yields each Set-Cookie on its own, so append keeps them separate.
  upstream.headers.forEach((value, name) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(name) && !connectionHeaders.has(name)) {
      headers.append(name, value);
    }
  });
  const location = headers.get("location");
  if (location !== null) {
    headers.set("location", toWebLocation(location, target, base));
  }
  if (!headers.has(REQUEST_ID_HEADER)) {
    headers.set(REQUEST_ID_HEADER, requestId);
  }

  const hasNullBody =
    method === "HEAD" || NULL_BODY_STATUSES.has(upstream.status);
  if (hasNullBody) {
    await upstream.body?.cancel();
  }
  return new Response(hasNullBody ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

// Location is resolved against the upstream URL, as the browser would resolve
// it. A URL on the API origin becomes a web-origin path, so the internal host
// never reaches the browser, and a path into the API (`<base path>/api/...`)
// loses the base path, so the browser stays on the proxy. Leading slashes are
// collapsed so the path cannot become a `//host` reference. Anything else, or
// a value that does not parse, is left unchanged.
function toWebLocation(location: string, target: URL, base: ApiBase): string {
  const url = URL.parse(location, target);
  if (url === null || url.origin !== base.origin) {
    return location;
  }
  const pathname = url.pathname.startsWith(`${base.path}/api/`)
    ? url.pathname.slice(base.path.length)
    : url.pathname;
  return `${pathname.replace(/^\/+/, "/")}${url.search}${url.hash}`;
}

/** Builds the API's error envelope, with the request ID in body and header. */
function errorResponse(
  status: number,
  code: ProxyErrorCode,
  message: string,
  requestId: string,
): Response {
  const envelope = {
    error: { code, message, request_id: requestId, details: null },
  } satisfies ErrorEnvelope;
  return Response.json(envelope, {
    status,
    headers: { [REQUEST_ID_HEADER]: requestId, "cache-control": "no-store" },
  });
}
