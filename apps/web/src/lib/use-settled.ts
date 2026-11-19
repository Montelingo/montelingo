"use client";

import { useEffect, useRef } from "react";

/**
 * Returns a check that is true once `delayMs` have passed since the component
 * mounted. A screen that appears under a child's finger uses it to ignore the
 * tap that brought it up. Read it in event handlers, not while rendering.
 *
 * `now` reads the clock, in epoch milliseconds; tests pass their own.
 */
export function useSettled(
  delayMs: number,
  now: () => number = Date.now,
): () => boolean {
  const mountedAt = useRef<number | null>(null);
  useEffect(() => {
    mountedAt.current = now();
    // The clock is read once, on mount: a new `now` does not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, []);
  return () =>
    mountedAt.current !== null && now() - mountedAt.current >= delayMs;
}
