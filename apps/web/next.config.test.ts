import { describe, expect, it } from "vitest";

import nextConfig from "./next.config";

async function headersFor(source: string) {
  const rules = (await nextConfig.headers?.()) ?? [];
  return rules.find((rule) => rule.source === source)?.headers ?? [];
}

// Mirrors `next dev`'s check (next/dist/server/dev/log-requests.js), which
// tests the pattern against the request URL, query included.
function isLogged(url: string): boolean {
  if (nextConfig.logging === false) {
    return false;
  }
  const incomingRequests = nextConfig.logging?.incomingRequests;
  if (typeof incomingRequests === "boolean") {
    return incomingRequests;
  }
  return !(incomingRequests?.ignore ?? []).some((pattern) => pattern.test(url));
}

describe("next.config", () => {
  describe("/reset-password headers", () => {
    it("keeps the token out of Referer headers and search indexes", async () => {
      expect(await headersFor("/reset-password")).toEqual([
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ]);
    });

    it("leaves the other auth pages alone", async () => {
      expect(await headersFor("/forgot-password")).toEqual([]);
      expect(await headersFor("/sign-in")).toEqual([]);
    });
  });

  describe("/media/words headers", () => {
    it("caches word images for a year, since their URL carries the file's hash", async () => {
      expect(await headersFor("/media/words/:path*")).toEqual([
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ]);
    });

    it("leaves the pages alone, which must not be cached", async () => {
      expect(await headersFor("/")).toEqual([]);
      expect(await headersFor("/:path*")).toEqual([]);
    });
  });

  describe("dev request logging", () => {
    it.each([
      "/reset-password",
      "/reset-password?token=secret",
      "/reset-password/?token=secret",
      "/reset-password?_rsc=1a2b3&token=secret",
    ])("never logs %s, whose query can hold the token", (url) => {
      expect(isLogged(url)).toBe(false);
    });

    it.each([
      "/",
      "/forgot-password",
      "/sign-in?notice=password-updated",
      "/reset-password-help",
      "/lessons/reset-password",
    ])("still logs %s", (url) => {
      expect(isLogged(url)).toBe(true);
    });
  });
});
