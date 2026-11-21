"use client";

import { type RefObject, useEffect, useRef } from "react";

/**
 * Keeps the keyboard's place when a screen swaps its buttons for new ones:
 * each time `step` changes, if the focused button has gone (the focus fell to
 * the page), the first button in `container` takes the focus. A tap leaves
 * nothing to restore, since the focus was never on the old button to lose.
 *
 * On mount only when `shouldFocusOnMount`: after "Igraj ponovo", whose button
 * has gone too, but not on a screen's first appearance.
 */
export function useFocusOnNewButtons(
  container: RefObject<HTMLElement | null>,
  step: number,
  shouldFocusOnMount: boolean,
): void {
  const hasMounted = useRef(false);
  useEffect(() => {
    const isMount = !hasMounted.current;
    hasMounted.current = true;
    if (isMount && !shouldFocusOnMount) {
      return;
    }
    const focused = document.activeElement;
    if (focused === null || focused === document.body) {
      container.current?.querySelector("button")?.focus();
    }
    // Only when `step` changes: `shouldFocusOnMount` is read once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [step]);
}
