import { once } from "node:events";
import { createServer, type IncomingHttpHeaders } from "node:http";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiBase } from "./api-config";
import { API_PROXY_MAX_BODY_BYTES, proxyApiRequest } from "./api-proxy";

const API_ORIGIN = "http://api.internal:8000";
const BASE: ApiBase = { origin: API_ORIGIN, path: "" };

const fetchMock = vi.fn<typeof fetch>();

function proxy(
  input: string,
  init: RequestInit = {},
  options: { base?: ApiBase; timeoutMs?: number } = {},
): Promise<Response> {
  const base = options.base ?? BASE;
  return proxyApiRequest(new Request(new URL(input, "http://web.test"), init), {
    getBase: () => base,
    fetch: fetchMock,
    timeoutMs: options.timeoutMs,
  });
}

function upstreamRequest(): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls[0];
  if (call === undefined) {
    throw new Error("fetch was not called");
  }
  const [input, init = {}] = call;
  if (!(input instanceof URL)) {
    throw new Error("expected fetch to be called with a URL");
  }
  return { url: input.href, init };
}

function upstreamBodyText(): Promise<string> {
  return new Response(upstreamRequest().init.body).text();
}

function upstreamHeaders(): Headers {
  return new Headers(upstreamRequest().init.headers);
}

type StreamingInit = RequestInit & { duplex: "half" };

// A stream the test feeds by hand, to model bodies that arrive over time.
function manualStream(): {
  stream: ReadableStream<Uint8Array>;
  push: (text: string) => void;
  close: () => void;
  fail: (reason: unknown) => void;
} {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
  });
  const encoder = new TextEncoder();
  return {
    stream,
    push: (text) => controller?.enqueue(encoder.encode(text)),
    close: () => controller?.close(),
    fail: (reason) => controller?.error(reason),
  };
}

function streamingBody(
  method: string,
  stream: ReadableStream<Uint8Array>,
  extra: RequestInit = {},
): StreamingInit {
  return { ...extra, method, body: stream, duplex: "half" };
}

// Like real fetch: the response body errors when the call's signal aborts.
function streamingUpstream(body: ReturnType<typeof manualStream>): void {
  fetchMock.mockImplementation((_input, init) => {
    init?.signal?.addEventListener("abort", () => {
      body.fail(init.signal?.reason);
    });
    return Promise.resolve(
      new Response(body.stream, { headers: { "content-type": "text/plain" } }),
    );
  });
}

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

describe("proxyApiRequest", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("request forwarding", () => {
    it("forwards the method, path, and query to the API", async () => {
      await proxy("/api/v1/lessons?level=a1&page=2", { method: "GET" });

      const { url, init } = upstreamRequest();
      expect(url).toBe(
        "http://api.internal:8000/api/v1/lessons?level=a1&page=2",
      );
      expect(init.method).toBe("GET");
      expect(init.redirect).toBe("manual");
      expect(init.cache).toBe("no-store");
    });

    it("forwards the request body for methods that carry one", async () => {
      await proxy("/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "a@example.com" }),
      });

      expect(upstreamRequest().init.method).toBe("POST");
      await expect(upstreamBodyText()).resolves.toBe(
        '{"email":"a@example.com"}',
      );
    });

    it.each(["GET", "HEAD"])("sends no body for %s", async (method) => {
      await proxy("/api/v1/lessons", { method });

      expect(upstreamRequest().init.body).toBeUndefined();
    });

    it("sends no body when a write request has an empty body", async () => {
      await proxy("/api/v1/auth/sign-out", { method: "POST" });

      expect(upstreamRequest().init.body).toBeUndefined();
    });

    it("forwards only the allowlisted request headers", async () => {
      await proxy("/api/v1/lessons", {
        headers: {
          accept: "application/json",
          "accept-language": "sr-Latn",
          "content-type": "application/json",
          cookie: "montelingo_session=abc; theme=dark",
          "if-modified-since": "Wed, 21 Oct 2026 07:28:00 GMT",
          "if-none-match": '"v1"',
          origin: "http://web.test",
          referer: "http://web.test/sign-in",
          "user-agent": "test-browser",
          "x-request-id": "req-123",
          authorization: "Bearer leaked",
          connection: "keep-alive",
          "keep-alive": "timeout=5",
          "x-forwarded-for": "6.6.6.6",
          "x-forwarded-host": "evil.test",
          "x-custom": "nope",
        },
      });

      expect(Object.fromEntries(upstreamHeaders())).toEqual({
        accept: "application/json",
        "accept-language": "sr-Latn",
        "content-type": "application/json",
        cookie: "montelingo_session=abc; theme=dark",
        "if-modified-since": "Wed, 21 Oct 2026 07:28:00 GMT",
        "if-none-match": '"v1"',
        origin: "http://web.test",
        referer: "http://web.test/sign-in",
        "user-agent": "test-browser",
        "x-request-id": "req-123",
      });
    });
  });

  describe("request body limit", () => {
    const tooLarge = {
      error: {
        code: "bad_request",
        message: "The request body is too large.",
        request_id: "req-big",
        details: null,
      },
    };

    it("answers 413 from Content-Length without reading the body", async () => {
      const body = manualStream();

      const response = await proxy(
        "/api/v1/answers",
        streamingBody("POST", body.stream, {
          headers: {
            "content-length": String(API_PROXY_MAX_BODY_BYTES + 1),
            "x-request-id": "req-big",
          },
        }),
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(response.status).toBe(413);
      expect(response.headers.get("x-request-id")).toBe("req-big");
      await expect(response.json()).resolves.toEqual(tooLarge);
    });

    it("answers 413 when a chunked body without Content-Length crosses the limit", async () => {
      const chunk = "a".repeat(64 * 1024);
      let pulled = 0;
      let cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulled += chunk.length;
          controller.enqueue(new TextEncoder().encode(chunk));
        },
        cancel() {
          cancelled = true;
        },
      });

      const response = await proxy(
        "/api/v1/answers",
        streamingBody("POST", stream, {
          headers: { "x-request-id": "req-big" },
        }),
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(response.status).toBe(413);
      await expect(response.json()).resolves.toEqual(tooLarge);
      expect(cancelled).toBe(true);
      expect(pulled).toBeLessThanOrEqual(
        API_PROXY_MAX_BODY_BYTES + 2 * chunk.length,
      );
    });

    it("answers 413 when the body is larger than its Content-Length says", async () => {
      const response = await proxy("/api/v1/answers", {
        method: "POST",
        headers: { "content-length": "2", "x-request-id": "req-big" },
        body: "a".repeat(API_PROXY_MAX_BODY_BYTES + 1),
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(response.status).toBe(413);
    });

    it("forwards a body of exactly the limit", async () => {
      await proxy("/api/v1/answers", {
        method: "POST",
        body: "a".repeat(API_PROXY_MAX_BODY_BYTES),
      });

      const forwarded = await new Response(
        upstreamRequest().init.body,
      ).arrayBuffer();
      expect(forwarded.byteLength).toBe(API_PROXY_MAX_BODY_BYTES);
    });

    it("joins a chunked body in order", async () => {
      const body = manualStream();
      body.push('{"answer":');
      body.push('"dobar dan"}');
      body.close();

      await proxy("/api/v1/answers", streamingBody("POST", body.stream));

      await expect(upstreamBodyText()).resolves.toBe('{"answer":"dobar dan"}');
    });

    it.each([
      ["one chunk", ['{"answer":"dobar dan"}']],
      ["several chunks", ['{"answer":', '"dobar dan"}']],
    ])(
      "sends a real Content-Length for a body in %s",
      async (_label, parts) => {
        const received: IncomingHttpHeaders[] = [];
        const server = createServer((req, res) => {
          received.push(req.headers);
          // No keep-alive, so fetch leaves no connection timers behind.
          res.setHeader("connection", "close");
          req.resume().on("end", () => res.end());
        });
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        const address = server.address();
        if (address === null || typeof address === "string") {
          throw new Error("expected a TCP address");
        }
        const body = manualStream();
        parts.forEach(body.push);
        body.close();

        try {
          await proxyApiRequest(
            new Request(
              "http://web.test/api/v1/answers",
              streamingBody("POST", body.stream),
            ),
            {
              getBase: () => ({
                origin: `http://127.0.0.1:${address.port}`,
                path: "",
              }),
            },
          );
        } finally {
          server.closeAllConnections();
          server.close();
        }

        expect(received).toHaveLength(1);
        expect(received[0]?.["content-length"]).toBe(
          String(new TextEncoder().encode(parts.join("")).byteLength),
        );
        expect(received[0]?.["transfer-encoding"]).toBeUndefined();
      },
    );

    it("answers 400 when the request body stream fails", async () => {
      const body = manualStream();
      body.fail(new Error("socket hang up"));

      const response = await proxy(
        "/api/v1/answers",
        streamingBody("POST", body.stream, {
          headers: { "x-request-id": "req-broken" },
        }),
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "bad_request",
          message: "The request body could not be read.",
          request_id: "req-broken",
          details: null,
        },
      });
    });

    it("stops reading and does not call the API when the client cancels mid-upload", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const controller = new AbortController();
      const body = manualStream();
      body.push("partial");

      const pending = proxy(
        "/api/v1/answers",
        streamingBody("POST", body.stream, { signal: controller.signal }),
      );
      controller.abort();
      const response = await pending;

      expect(fetchMock).not.toHaveBeenCalled();
      expect(response.status).toBe(502);
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe("request IDs", () => {
    it("generates a request ID when the client sends none", async () => {
      await proxy("/api/v1/lessons");

      expect(upstreamHeaders().get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    });

    it.each(["has spaces", "a".repeat(129), "semi;colon", "   "])(
      "replaces an unsafe request ID (%s)",
      async (requestId) => {
        await proxy("/api/v1/lessons", {
          headers: { "x-request-id": requestId },
        });

        const forwarded = upstreamHeaders().get("x-request-id");
        expect(forwarded).not.toBe(requestId);
        expect(forwarded).toMatch(/^[0-9a-f-]{36}$/);
      },
    );

    it("returns the API's request ID", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ ok: true }, { headers: { "x-request-id": "req-api" } }),
      );

      const response = await proxy("/api/v1/lessons");

      expect(response.headers.get("x-request-id")).toBe("req-api");
    });

    it("returns the forwarded request ID when the API sends none", async () => {
      const response = await proxy("/api/v1/lessons", {
        headers: { "x-request-id": "req-client" },
      });

      expect(response.headers.get("x-request-id")).toBe("req-client");
    });
  });

  describe("response forwarding", () => {
    it("returns the API's status and body", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: { code: "validation_error" } }, { status: 422 }),
      );

      const response = await proxy("/api/v1/auth/sign-up", { method: "POST" });

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        error: { code: "validation_error" },
      });
    });

    it("returns every Set-Cookie header separately", async () => {
      const headers = new Headers();
      headers.append(
        "set-cookie",
        "montelingo_session=abc; Path=/; HttpOnly; SameSite=Lax; Expires=Wed, 21 Oct 2026 07:28:00 GMT",
      );
      headers.append("set-cookie", "csrf_hint=xyz; Path=/; SameSite=Strict");
      fetchMock.mockResolvedValue(new Response(null, { status: 204, headers }));

      const response = await proxy("/api/v1/auth/sign-in", { method: "POST" });

      expect(response.headers.getSetCookie()).toEqual([
        "montelingo_session=abc; Path=/; HttpOnly; SameSite=Lax; Expires=Wed, 21 Oct 2026 07:28:00 GMT",
        "csrf_hint=xyz; Path=/; SameSite=Strict",
      ]);
    });

    it("strips hop-by-hop, Connection-listed, and stale encoding headers", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { ok: true },
          {
            headers: {
              connection: "keep-alive, x-upstream-hop",
              "keep-alive": "timeout=5",
              "proxy-authenticate": "Basic",
              trailer: "expires",
              upgrade: "h2c",
              "x-upstream-hop": "1",
              "content-encoding": "gzip",
              "content-length": "999",
              "cache-control": "no-store",
              "x-custom-upstream": "yes",
            },
          },
        ),
      );

      const response = await proxy("/api/v1/lessons");

      for (const name of [
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "trailer",
        "upgrade",
        "x-upstream-hop",
        "content-encoding",
        "content-length",
      ]) {
        expect(response.headers.has(name)).toBe(false);
      }
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-custom-upstream")).toBe("yes");
      expect(response.headers.get("content-type")).toBe("application/json");
    });

    it.each([204, 205])("returns no body for status %i", async (status) => {
      fetchMock.mockResolvedValue(new Response(null, { status }));

      const response = await proxy("/api/v1/auth/sign-out", {
        method: "POST",
      });

      expect(response.status).toBe(status);
      expect(response.body).toBeNull();
    });

    it("returns no body for HEAD", async () => {
      const response = await proxy("/api/v1/lessons", { method: "HEAD" });

      expect(response.status).toBe(200);
      expect(response.body).toBeNull();
    });

    it("passes a conditional GET's 304 through with no body", async () => {
      fetchMock.mockResolvedValue(
        new Response(null, {
          status: 304,
          headers: { etag: '"v1"', "cache-control": "private, no-cache" },
        }),
      );

      const response = await proxy("/api/v1/lessons", {
        headers: { "if-none-match": '"v1"' },
      });

      expect(upstreamHeaders().get("if-none-match")).toBe('"v1"');
      expect(response.status).toBe(304);
      expect(response.body).toBeNull();
      expect(response.headers.get("etag")).toBe('"v1"');
      expect(response.headers.get("cache-control")).toBe("private, no-cache");
    });

    it("passes redirects through without following them", async () => {
      fetchMock.mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "/sign-in?next=%2Flessons" },
        }),
      );

      const response = await proxy("/api/v1/auth/session");

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/sign-in?next=%2Flessons");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    describe("Location rewriting", () => {
      it.each([
        // Into the API: a web-origin path without the base path.
        [
          "",
          `${API_ORIGIN}/api/v1/lessons?page=2#top`,
          "/api/v1/lessons?page=2#top",
        ],
        ["", "/api/v1/lessons", "/api/v1/lessons"],
        ["", "//api.internal:8000/api/v1/lessons", "/api/v1/lessons"],
        [
          "/backend",
          `${API_ORIGIN}/backend/api/v1/lessons?page=2`,
          "/api/v1/lessons?page=2",
        ],
        ["/backend", "/backend/api/v1/lessons", "/api/v1/lessons"],
        [
          "/backend",
          "//api.internal:8000/backend/api/v1/lessons",
          "/api/v1/lessons",
        ],
        // Outside <base path>/api/ on the API origin: the origin is dropped.
        ["", `${API_ORIGIN}/docs?x=1`, "/docs?x=1"],
        ["", `${API_ORIGIN}/api`, "/api"],
        // A leading `//` would turn the path into a reference to another host.
        ["", `${API_ORIGIN}//evil.test/x`, "/evil.test/x"],
        ["", "/sign-in?next=%2Flessons", "/sign-in?next=%2Flessons"],
        ["/backend", `${API_ORIGIN}/backend/docs`, "/backend/docs"],
        ["/backend", "/api/v1/lessons", "/api/v1/lessons"],
        // Other origins are left unchanged.
        [
          "",
          "https://accounts.example.com/authorize",
          "https://accounts.example.com/authorize",
        ],
        [
          "",
          "http://api.internal:9000/api/v1/lessons",
          "http://api.internal:9000/api/v1/lessons",
        ],
        ["", "//evil.test/api/v1", "//evil.test/api/v1"],
        ["", "\\\\evil.test/api/v1", "\\\\evil.test/api/v1"],
        // Relative references resolve against the request, as in the browser.
        ["", "drafts?page=2", "/api/v1/lessons/drafts?page=2"],
        ["/backend", "drafts", "/api/v1/lessons/drafts"],
        ["", "../", "/api/v1/"],
        ["", "?page=2", "/api/v1/lessons/7?page=2"],
        // Unparsable values are left unchanged.
        ["", "http://[bad", "http://[bad"],
      ])(
        "with base path %j rewrites %s to %s",
        async (path, location, expected) => {
          fetchMock.mockResolvedValue(
            new Response(null, { status: 307, headers: { location } }),
          );

          const response = await proxy(
            "/api/v1/lessons/7",
            {},
            { base: { origin: API_ORIGIN, path } },
          );

          expect(response.headers.get("location")).toBe(expected);
        },
      );
    });
  });

  describe("API base", () => {
    it.each([
      ["", "http://api.internal:8000/api/v1/lessons"],
      ["/backend", "http://api.internal:8000/backend/api/v1/lessons"],
    ])("appends the request path to base path %j", async (path, expected) => {
      await proxy(
        "/api/v1/lessons",
        {},
        { base: { origin: API_ORIGIN, path } },
      );

      expect(upstreamRequest().url).toBe(expected);
    });

    it.each(["not a url", "ftp://api:8000", "http://user:pass@api:8000"])(
      "answers a 500 envelope when API_INTERNAL_BASE_URL is %s",
      async (baseUrl) => {
        const consoleError = vi
          .spyOn(console, "error")
          .mockImplementation(() => undefined);
        vi.stubEnv("API_INTERNAL_BASE_URL", baseUrl);

        const response = await proxyApiRequest(
          new Request("http://web.test/api/v1/lessons", {
            headers: { "x-request-id": "req-config" },
          }),
          { fetch: fetchMock },
        );

        expect(fetchMock).not.toHaveBeenCalled();
        expect(response.status).toBe(500);
        expect(response.headers.get("x-request-id")).toBe("req-config");
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.get("content-type")).toContain(
          "application/json",
        );
        await expect(response.json()).resolves.toEqual({
          error: {
            code: "internal_server_error",
            message: "An unexpected error occurred.",
            request_id: "req-config",
            details: null,
          },
        });
        expect(consoleError).toHaveBeenCalledTimes(1);
        expect(consoleError.mock.calls[0]?.at(-1)).toBeInstanceOf(Error);
      },
    );

    it("replaces an unsafe request ID on a configuration error", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      const response = await proxyApiRequest(
        new Request("http://web.test/api/v1/lessons", {
          headers: { "x-request-id": "has spaces" },
        }),
        {
          getBase: () => {
            throw new Error("bad config");
          },
          fetch: fetchMock,
        },
      );

      const requestId = response.headers.get("x-request-id");
      expect(response.status).toBe(500);
      expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
      await expect(response.json()).resolves.toMatchObject({
        error: { request_id: requestId },
      });
    });
  });

  describe("path safety", () => {
    it.each([
      "/api/%2e%2e/secret",
      "/api/%2E%2e/secret",
      "/api/v1/%2e%2e/%2e%2e/secret",
      "/api/v1/..%2fsecret",
      "/api/v1/..%2F..%2Fsecret",
      "/api/v1/%2e%2e%5csecret",
      "/api/v1/%5c%5cevil.test",
      "/api/%2e",
      "/api/v1/%zz",
    ])("rejects %s with a not_found envelope", async (path) => {
      const response = await proxy(path, {
        headers: { "x-request-id": "req-path" },
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
      expect(response.headers.get("x-request-id")).toBe("req-path");
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "not_found",
          message: "Resource not found.",
          request_id: "req-path",
          details: null,
        },
      });
    });

    it("rejects a backslash traversal that leaves /api/", async () => {
      const response = await proxyApiRequest(
        new Request("http://web.test/api\\..\\secret"),
        { getBase: () => BASE, fetch: fetchMock },
      );

      expect(response.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a traversal out of the base path prefix", async () => {
      const response = await proxy(
        "/api/%2e%2e/%2e%2e/admin",
        {},
        { base: { origin: API_ORIGIN, path: "/backend" } },
      );

      expect(response.status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps a double slash after /api/ on the API host", async () => {
      await proxy("/api//evil.test/steal");

      const target = new URL(upstreamRequest().url);
      expect(target.origin).toBe("http://api.internal:8000");
      expect(target.pathname).toBe("/api//evil.test/steal");
    });

    it("keeps a double slash after /api/ under a base path prefix", async () => {
      await proxy(
        "/api//evil.test/steal",
        {},
        { base: { origin: API_ORIGIN, path: "/backend" } },
      );

      const target = new URL(upstreamRequest().url);
      expect(target.origin).toBe("http://api.internal:8000");
      expect(target.pathname).toBe("/backend/api//evil.test/steal");
    });

    it("allows encoded characters that are not separators", async () => {
      await proxy("/api/v1/words/%C4%8Dovjek");

      expect(upstreamRequest().url).toBe(
        "http://api.internal:8000/api/v1/words/%C4%8Dovjek",
      );
    });
  });

  describe("upstream failures", () => {
    it("returns a 502 envelope when the API is unreachable", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      fetchMock.mockRejectedValue(new TypeError("fetch failed"));

      const response = await proxy("/api/v1/lessons", {
        headers: { "x-request-id": "req-down" },
      });

      expect(response.status).toBe(502);
      expect(response.headers.get("x-request-id")).toBe("req-down");
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "service_unavailable",
          message: "The API is unavailable.",
          request_id: "req-down",
          details: null,
        },
      });
      expect(consoleError).toHaveBeenCalledTimes(1);
    });

    it("does not log when the client cancels the request", async () => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      const controller = new AbortController();
      fetchMock.mockImplementation(() => {
        controller.abort();
        return Promise.reject(new DOMException("aborted", "AbortError"));
      });

      await proxy("/api/v1/lessons", { signal: controller.signal });

      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe("timeout scope", () => {
    it("does not cut off a response body that streams past the timeout", async () => {
      vi.useFakeTimers();
      const body = manualStream();
      streamingUpstream(body);

      const response = await proxy("/api/v1/export", {}, { timeoutMs: 100 });
      body.push("first,");
      await vi.advanceTimersByTimeAsync(1_000);
      body.push("second");
      body.close();

      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toBe("first,second");
      expect(upstreamRequest().init.signal?.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("starts the timeout after the request body is read", async () => {
      vi.useFakeTimers();
      fetchMock.mockImplementation((_input, init) =>
        init?.signal?.aborted
          ? Promise.reject(new Error("aborted"))
          : Promise.resolve(jsonResponse({ ok: true })),
      );
      const body = manualStream();

      const pending = proxy(
        "/api/v1/answers",
        streamingBody("POST", body.stream),
        { timeoutMs: 100 },
      );
      await vi.advanceTimersByTimeAsync(1_000);
      body.push("{}");
      body.close();
      const response = await pending;

      expect(response.status).toBe(200);
    });

    it("answers a 504 envelope when response headers take longer than the timeout", async () => {
      vi.useFakeTimers();
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      fetchMock.mockImplementation(
        (_input, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new Error("aborted", { cause: init.signal?.reason }));
            });
          }),
      );

      const pending = proxy(
        "/api/v1/lessons",
        { headers: { "x-request-id": "req-slow" } },
        { timeoutMs: 100 },
      );
      await vi.advanceTimersByTimeAsync(99);
      expect(upstreamRequest().init.signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const response = await pending;

      expect(response.status).toBe(504);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "service_unavailable",
          message: "The API did not respond in time.",
          request_id: "req-slow",
          details: null,
        },
      });
      expect(consoleError).toHaveBeenCalledTimes(1);
    });

    it("still cancels a streaming response body when the client disconnects", async () => {
      const controller = new AbortController();
      const body = manualStream();
      streamingUpstream(body);

      const response = await proxy("/api/v1/export", {
        signal: controller.signal,
      });
      body.push("first,");
      controller.abort();

      expect(upstreamRequest().init.signal?.aborted).toBe(true);
      await expect(response.text()).rejects.toThrow();
    });
  });
});
