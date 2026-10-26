import { describe, expect, it } from "vitest";

import { MAP_NOTICES, parseMapNotice, withMapNotice } from "./notices";

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
