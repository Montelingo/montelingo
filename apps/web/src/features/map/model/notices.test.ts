import { describe, expect, it } from "vitest";

import {
  MAP_NOTICES,
  mapNoticeIn,
  parseMapNotice,
  withMapNotice,
  withoutMapNotice,
} from "./notices";

describe("parseMapNotice", () => {
  it.each(Object.keys(MAP_NOTICES))("accepts %j", (notice) => {
    expect(parseMapNotice(notice)).toBe(notice);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["unknown", "region-deleted"],
    ["in another case", "Region-Locked"],
    ["free text", "Your account is locked. Call +1 555 0100."],
    ["an inherited property", "constructor"],
    ["a prototype key", "__proto__"],
    ["a repeated parameter", ["region-locked", "region-locked"]],
    ["not a string", 1],
  ])("ignores a notice that is %s", (_case, value) => {
    expect(parseMapNotice(value)).toBeNull();
  });
});

describe("withMapNotice", () => {
  it("adds the notice to the path", () => {
    expect(withMapNotice("/play/coast", "location-locked")).toBe(
      "/play/coast?notice=location-locked",
    );
  });
});

describe("mapNoticeIn", () => {
  it("reads a known notice from a query string", () => {
    expect(mapNoticeIn(new URLSearchParams("notice=region-locked"))).toBe(
      "region-locked",
    );
  });

  it.each([
    ["missing", ""],
    ["unknown", "notice=region-deleted"],
    ["under another name", "warning=region-locked"],
  ])("ignores a notice that is %s", (_case, query) => {
    expect(mapNoticeIn(new URLSearchParams(query))).toBeNull();
  });
});

describe("withoutMapNotice", () => {
  const origin = "https://montelingo.test";

  it.each([
    ["the only parameter", "/play?notice=region-locked", "/play"],
    [
      "among others, kept in order and encoding",
      "/play/coast?from=map&notice=location-locked&q=a%20b+c",
      "/play/coast?from=map&q=a%20b+c",
    ],
    [
      "before a hash, which is kept",
      "/play?notice=region-locked#regions",
      "/play#regions",
    ],
    ["unknown, still dropped", "/play?notice=whatever", "/play"],
    ["without a value", "/play?notice", "/play"],
    ["percent-encoded", "/play?%6Eotice=region-locked&x=1", "/play?x=1"],
    [
      "repeated",
      "/play?notice=region-locked&x=1&notice=location-locked",
      "/play?x=1",
    ],
  ])("drops a notice that is %s", (_case, path, expected) => {
    expect(withoutMapNotice(`${origin}${path}`)).toBe(expected);
  });

  it.each([
    ["no query string", "/play"],
    ["other parameters only", "/play?from=map#regions"],
    ["the word only in a value", "/play?from=notice"],
  ])("returns null for a URL with %s", (_case, path) => {
    expect(withoutMapNotice(`${origin}${path}`)).toBeNull();
  });
});
