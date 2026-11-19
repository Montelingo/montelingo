import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useSettled } from "./use-settled";

function clock(start: number) {
  const time = { now: start };
  return { time, now: () => time.now };
}

describe("useSettled", () => {
  it("is false until the delay has passed since mount, then true", () => {
    const { time, now } = clock(1_000);
    const { result } = renderHook(() => useSettled(600, now));

    expect(result.current()).toBe(false);
    time.now = 1_599;
    expect(result.current()).toBe(false);
    time.now = 1_600;
    expect(result.current()).toBe(true);
  });

  it("counts from mount, not from a later render", () => {
    const { time, now } = clock(1_000);
    const { result, rerender } = renderHook(() => useSettled(600, now));

    time.now = 1_500;
    rerender();
    time.now = 1_600;

    expect(result.current()).toBe(true);
  });

  it("starts again when it mounts again", () => {
    const { time, now } = clock(1_000);
    const first = renderHook(() => useSettled(600, now));
    time.now = 2_000;
    first.unmount();

    const { result } = renderHook(() => useSettled(600, now));

    expect(result.current()).toBe(false);
  });
});
