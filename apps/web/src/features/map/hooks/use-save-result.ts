"use client";

import { ApiClientError } from "@app/api-client";
import { useCallback, useEffect, useRef, useState } from "react";

import { signInHref } from "@/features/auth/edge";
import { useNavigate } from "@/lib/use-navigate";

import {
  completeGame,
  completeLesson,
  completePractice,
  type Recorded,
} from "../api/progress-browser-api";
import { isSignedOut } from "../errors";
import type { GameId } from "../model/progress";

/**
 * What finishing records: a chapter's lesson or one of its games, saved once
 * a visit (ADR 0006), or a practice game, saved every time (ADR 0009).
 */
export type SavedResult =
  | { kind: "lesson"; chapterId: string }
  | { kind: "game"; chapterId: string; gameId: GameId }
  | { kind: "practice"; gameId: GameId };

/**
 * `idle` until the child finishes, then `saving`, and `saved` or `failed`.
 * A retry goes from `failed` back to `saving`.
 */
export type SaveStatus = "idle" | "saving" | "saved" | "failed";

export type SaveResult = {
  status: SaveStatus;
  /** Whether a save has failed this visit: the notice stays after that. */
  hasFailed: boolean;
  /** Whether the save earned a heart: a replay, under the daily cap (ADR 0009). */
  heartEarned: boolean;
  /**
   * Saves the result: a chapter's once a visit, so later calls do nothing; a
   * practice game's each time, unless one is still saving.
   */
  save: () => void;
  /** Saves again after a failure. Does nothing at any other time. */
  retry: () => void;
};

function record(result: SavedResult): Promise<Recorded> {
  switch (result.kind) {
    case "lesson":
      return completeLesson(result.chapterId);
    case "game":
      return completeGame(result.chapterId, result.gameId);
    case "practice":
      return completePractice(result.gameId);
  }
}

/** `409`: the place is locked, or the game is until the lesson is seen. */
function isConflict(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 409;
}

/**
 * Saves a finished lesson or game (ADR 0006), or practice game (ADR 0009),
 * from the browser. Once it is
 * saved and the child leaves the screen, the router refreshes, which also
 * drops its cache, so the place's screen shows the new state, by its link or
 * by Back, with no full reload. The refresh waits until the child leaves: one
 * started on this screen is dropped when Back lands mid-way, and Back then
 * shows the place from the router's cache, from before the save. A child who
 * left while it was saving gets the refresh as soon as it saves. A failure keeps the child where they are, with a retry; the
 * caller shows it on the "Bravo!" screen. A `409` means the server will not
 * record it here, so the child goes back to the place's screen, which sends
 * them on if the place is closed. A `401` means they were signed out: sign in,
 * then back to the place.
 *
 * The redirects happen only while the screen is still on show: a child who
 * has already gone back to the place is not moved again.
 */
export function useSaveResult(
  result: SavedResult,
  placeHref: string,
): SaveResult {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [hasFailed, setHasFailed] = useState(false);
  const [heartEarned, setHeartEarned] = useState(false);
  // Set at once, unlike `status`, so a double call saves only once.
  const isSaving = useRef(false);
  const hasStarted = useRef(false);
  const isFailed = useRef(false);
  const isSaved = useRef(false);
  const isMounted = useRef(false);

  // The latest values, so `save` and `retry` keep their identity.
  const latest = useRef({ result, placeHref, navigate });
  useEffect(() => {
    latest.current = { result, placeHref, navigate };
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Leaving after the save: the next screen is the router's by now.
      if (isSaved.current) {
        latest.current.navigate.refresh();
      }
    };
  }, []);

  const run = useCallback(() => {
    if (isSaving.current) {
      return;
    }
    isSaving.current = true;
    isFailed.current = false;
    setStatus("saving");
    // A new practice game starts without the last one's heart.
    setHeartEarned(false);
    const { result: current } = latest.current;
    record(current).then(
      (recorded) => {
        isSaving.current = false;
        setStatus("saved");
        setHeartEarned(recorded.heartEarned);
        if (isMounted.current) {
          isSaved.current = true;
        } else {
          latest.current.navigate.refresh();
        }
      },
      (error: unknown) => {
        isSaving.current = false;
        const { placeHref: place, navigate: go } = latest.current;
        if (isConflict(error) || isSignedOut(error)) {
          if (isMounted.current) {
            go.replace(isConflict(error) ? place : signInHref(place));
          }
          return;
        }
        isFailed.current = true;
        setStatus("failed");
        setHasFailed(true);
      },
    );
  }, []);

  const save = useCallback(() => {
    if (latest.current.result.kind === "practice") {
      // Every practice game is saved (ADR 0009), each from a fresh notice.
      if (!isSaving.current) {
        setHasFailed(false);
        run();
      }
      return;
    }
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;
    run();
  }, [run]);

  const retry = useCallback(() => {
    if (isFailed.current) {
      run();
    }
  }, [run]);

  return { status, hasFailed, heartEarned, save, retry };
}
