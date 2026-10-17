import { describe, expect, it } from "vitest";

import { isPathWithin } from "./url-path";

describe("isPathWithin", () => {
  it.each([
    "/play",
    "/play/",
    "/play/kotor",
    "/play/kotor/old-town",
    "/%70lay",
    "/%70lay/kotor",
    "/play%2Fkotor",
    "/play/%E0%A4%A",
  ])("puts %j inside /play", (pathname) => {
    expect(isPathWithin(pathname, "/play")).toBe(true);
  });

  it.each([
    "/",
    "/playground",
    "/player/1",
    "/Play",
    "/account/play",
    "/%70layground",
    "/%70lay/%E0%A4%A",
    "/%E0%A4%A",
  ])("puts %j outside /play", (pathname) => {
    expect(isPathWithin(pathname, "/play")).toBe(false);
  });
});
