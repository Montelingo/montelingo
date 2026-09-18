import { describe, expect, it } from "vitest";

import { normalizeHealthState } from "./health";

describe("normalizeHealthState", () => {
  it("returns healthy when status is true", () => {
    expect(normalizeHealthState(true)).toBe("healthy");
  });

  it("returns unavailable when status is false", () => {
    expect(normalizeHealthState(false)).toBe("unavailable");
  });
});
