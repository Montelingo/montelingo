"use client";

import { useRef } from "react";
import { type SwipeableHandlers, useSwipeable } from "react-swipeable";

// A swipe must travel this far (CSS px) to turn the card; less is a tap.
const SWIPE_DISTANCE = 40;

type CardSwipe = {
  /** Spread on the card. */
  handlers: SwipeableHandlers;
  /** The card's `onClick`: a tap is Next. */
  onClick: () => void;
};

/**
 * A swipe left (with a finger, or a mouse drag) is Next, a swipe right is
 * Back, and a tap is Next. A swipe ends with a click on the card when the
 * mouse is let go: that click is the swipe's, not a tap.
 */
export function useCardSwipe(
  onNext: () => void,
  onBack: () => void,
): CardSwipe {
  const swiped = useRef(false);
  const handlers = useSwipeable({
    onTouchStartOrOnMouseDown: () => {
      swiped.current = false;
    },
    onSwiped: () => {
      swiped.current = true;
    },
    onSwipedLeft: onNext,
    onSwipedRight: onBack,
    delta: SWIPE_DISTANCE,
    trackMouse: true,
  });
  const onClick = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    onNext();
  };
  return { handlers, onClick };
}
