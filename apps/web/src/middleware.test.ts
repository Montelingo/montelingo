import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PROTECTED_PATH_PREFIXES } from "@/features/auth/edge";

import { config, middleware } from "./middleware";

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(
    new URL(path, "http://web.test"),
    cookie === undefined ? {} : { headers: { cookie } },
  );
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
    const response = middleware(request("/accounting"));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("runs on exactly the protected paths and everything under them", () => {
    expect(config.matcher).toEqual(
      PROTECTED_PATH_PREFIXES.map((prefix) => `${prefix}/:path*`),
    );
  });
});
