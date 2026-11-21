"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type GameVisit = {
  /** Counts the games this visit, from 0: the key that deals a fresh one. */
  game: number;
  /** A second game or later: the words are not new and the sticker is given. */
  isReplay: boolean;
  /** Deal a new game. */
  playAgain: () => void;
};

/**
 * A game's visit (ADR 0006): it can be played again and again, but
 * `onCompleted` is called once, the first time `isFinished` turns true.
 * Marked only when called, so a callback passed in late still runs.
 */
export function useGameVisit(
  isFinished: boolean,
  onCompleted: (() => void) | undefined,
): GameVisit {
  const [game, setGame] = useState(0);
  const hasReported = useRef(false);
  useEffect(() => {
    if (isFinished && !hasReported.current && onCompleted !== undefined) {
      hasReported.current = true;
      onCompleted();
    }
  }, [isFinished, onCompleted]);
  const playAgain = useCallback(() => setGame((current) => current + 1), []);
  return { game, isReplay: game > 0, playAgain };
}
