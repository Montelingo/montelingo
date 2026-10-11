import { describe, expect, it } from "vitest";

import { parseResetToken } from "./reset-token";

describe("parseResetToken", () => {
  it.each([
    ["a typical token", "Zx3-k9_Qp0aLm2VtR8wYb4"],
    ["a single character", "a"],
    ["256 characters", "a".repeat(256)],
    ["256 code points that are 512 UTF-16 units", "😀".repeat(256)],
    // Opaque: whitespace and any characters are the API's to judge.
    ["surrounding whitespace", " abc "],
    ["URL-special characters", "a+b/c=d%e"],
  ])("keeps %s exactly", (_case, token) => {
    expect(parseResetToken(token)).toBe(token);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["257 characters", "a".repeat(257)],
    ["a repeated parameter", ["a", "b"]],
    ["a single-item array", ["abc"]],
    ["not a string", 42],
    ["null", null],
  ])("rejects a token that is %s", (_case, value) => {
    expect(parseResetToken(value)).toBeNull();
  });
});
