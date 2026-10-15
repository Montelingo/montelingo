import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PROTECTED_PATH_PREFIXES,
  REQUESTED_PATH_HEADER,
} from "@/features/auth/edge";

import { config, middleware } from "./middleware";

function request(
  path: string,
  cookie?: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(new URL(path, "http://web.test"), {
    headers: cookie === undefined ? headers : { ...headers, cookie },
  });
}

// NextResponse.next({ request: { headers } }) passes the new request headers to
// the render as x-middleware-request-<name> response headers, which Next.js
// strips before the response leaves the server.
function forwardedRequestPath(response: Response): string | null {
  return response.headers.get(`x-middleware-request-${REQUESTED_PATH_HEADER}`);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("middleware", () => {
  it("redirects a protected page without a session cookie to sign in", () => {
    const response = middleware(request("/account?tab=email"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://web.test/sign-in?next=%2Faccount%3Ftab%3Demail",
    );
  });

  it("redirects the learner area without a session cookie to sign in", () => {
    const response = middleware(request("/play/kotor?x=1"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://web.test/sign-in?next=%2Fplay%2Fkotor%3Fx%3D1",
    );
    expect(forwardedRequestPath(response)).toBeNull();
  });

  it("ignores other cookies", () => {
    const response = middleware(request("/account", "theme=dark"));

    expect(response.headers.get("location")).toBe(
      "http://web.test/sign-in?next=%2Faccount",
    );
  });

  it("lets a protected page with a session cookie through", () => {
    const response = middleware(
      request("/account", "theme=dark; montelingo_session=opaque-token"),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("hands the requested path and query string to the render", () => {
    const response = middleware(
      request("/play/kotor?x=1", "montelingo_session=opaque-token"),
    );

    expect(response.headers.get("location")).toBeNull();
    expect(forwardedRequestPath(response)).toBe("/play/kotor?x=1");
    expect(
      response.headers.get("x-middleware-override-headers")?.split(","),
    ).toContain(REQUESTED_PATH_HEADER);
  });

  it("replaces a requested path the client sent", () => {
    const response = middleware(
      request("/play", "montelingo_session=opaque-token", {
        [REQUESTED_PATH_HEADER]: "https://evil.com",
      }),
    );

    expect(forwardedRequestPath(response)).toBe("/play");
  });

  it("keeps the other request headers", () => {
    const response = middleware(
      request("/account", "montelingo_session=opaque-token", {
        "accept-language": "sr-ME",
      }),
    );

    expect(response.headers.get("x-middleware-request-accept-language")).toBe(
      "sr-ME",
    );
    expect(response.headers.get("x-middleware-request-cookie")).toBe(
      "montelingo_session=opaque-token",
    );
  });

  it("follows a renamed session cookie, like the API", () => {
    vi.stubEnv("MONTELINGO_SESSION_COOKIE_NAME", "ml_sid");

    expect(
      middleware(request("/account", "ml_sid=opaque-token")).headers.get(
        "location",
      ),
    ).toBeNull();
    expect(
      middleware(
        request("/account", "montelingo_session=opaque-token"),
      ).headers.get("location"),
    ).toBe("http://web.test/sign-in?next=%2Faccount");
  });

  it("lets a public page through without a session cookie", () => {
    const response = middleware(request("/playground"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("runs on exactly the protected paths and everything under them", () => {
    expect(config.matcher).toEqual(
      PROTECTED_PATH_PREFIXES.map((prefix) => `${prefix}/:path*`),
    );
  });
});
