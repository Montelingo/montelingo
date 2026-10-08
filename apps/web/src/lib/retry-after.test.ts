import { describe, expect, it } from "vitest";

import { parseRetryAfter } from "./retry-after";

const NOW = new Date("2026-10-08T12:00:00Z");

describe("parseRetryAfter", () => {
  it.each([
    ["0", 0],
    ["1", 1],
    ["120", 120],
    [" 30 ", 30],
    ["86400", 86400],
  ])("reads delta-seconds %j as %i", (value, seconds) => {
    expect(parseRetryAfter(value, NOW)).toBe(seconds);
  });

  it.each([
    ["IMF-fixdate", "Thu, 08 Oct 2026 12:00:45 GMT"],
    ["RFC 850", "Thursday, 08-Oct-26 12:00:45 GMT"],
    ["asctime", "Thu Oct  8 12:00:45 2026"],
  ])("reads an %s date relative to now", (_format, value) => {
    expect(parseRetryAfter(value, NOW)).toBe(45);
  });

  it("rounds a partial second up", () => {
    expect(
      parseRetryAfter(
        "Thu, 08 Oct 2026 12:00:45 GMT",
        new Date("2026-10-08T12:00:00.250Z"),
      ),
    ).toBe(45);
  });

  it("reads a date in the past as no wait", () => {
    expect(parseRetryAfter("Thu, 08 Oct 2026 11:59:00 GMT", NOW)).toBe(0);
  });

  it.each([
    ["missing", null],
    ["empty", ""],
    ["a word", "soon"],
    ["a decimal number", "1.5"],
    ["a negative number", "-5"],
    ["a loosely formatted date", "12 30"],
    ["an ISO date", "2026-10-08T12:00:45Z"],
    ["over a day in seconds", "86401"],
    ["a date over a day away", "Sat, 10 Oct 2026 12:00:00 GMT"],
  ])("returns null when the value is %s", (_case, value) => {
    expect(parseRetryAfter(value, NOW)).toBeNull();
  });
});
