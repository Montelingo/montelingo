"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";

/**
 * Keeps the keyboard's place when a screen swaps its buttons for new ones:
 * each time `step` changes, if the focused button has gone (the focus fell to
 * the page), the first button in `container` takes the focus. A tap leaves
 * nothing to restore, since the focus was never on the old button to lose.
 *
 * On mount only when `shouldFocusOnMount`: after "Igraj ponovo", whose button
 * has gone too, but not on a screen's first appearance. While `container` is
 * not on the page (a game still loading its pictures), nothing counts: its
 * first appearance is still to come, so change `step` when it appears.
 *
 * A layout effect, so the focus moves in the same commit as the new buttons:
 * neither a screen reader nor a test ever finds it on the page between the
 * two (#302).
 */
export function useFocusOnNewButtons(
  container: RefObject<HTMLElement | null>,
  step: number,
  shouldFocusOnMount: boolean,
): void {
  const hasMounted = useRef(false);
  useLayoutEffect(() => {
    if (container.current === null) {
      return;
    }
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
