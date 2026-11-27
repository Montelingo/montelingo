"use client";

import { useEffect, useRef, useState } from "react";

import { HOLD_MS, holdProgress, isHoldComplete } from "../model/gate";

/**
 * How often the ring is redrawn while a digit is held: 60 steps, every 25ms,
 * so the last one lands on HOLD_MS rather than just after it.
 */
const TICK_MS = HOLD_MS / 60;

type Hold = { digit: number; startedAt: number };

export type HoldState = {
  /** The digit being held, or `null`. */
  heldDigit: number | null;
  /** How far the held digit's ring is filled, from 0 to 1. */
  progress: number;
  start: (digit: number) => void;
  /** Lets go: the ring empties. */
  stop: () => void;
};

/**
 * A press and hold on one digit: the ring fills over `HOLD_MS`, letting go
 * early empties it, and a full hold calls `onComplete` once.
 */
export function useHold(onComplete: () => void): HoldState {
  const [hold, setHold] = useState<Hold | null>(null);
  const [progress, setProgress] = useState(0);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (hold === null) {
      return;
    }
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - hold.startedAt;
      setProgress(holdProgress(elapsed));
      if (isHoldComplete(elapsed)) {
        window.clearInterval(timer);
        setHold(null);
        onCompleteRef.current();
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [hold]);

  return {
    heldDigit: hold?.digit ?? null,
    progress: hold === null ? 0 : progress,
    start(digit) {
      setProgress(0);
      setHold({ digit, startedAt: Date.now() });
    },
    stop() {
      setHold(null);
      setProgress(0);
    },
  };
}
