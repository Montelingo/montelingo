"use client";

import { ApiClientError } from "@app/api-client";
import { useCallback, useRef, useState } from "react";

import { PLAY_PATH, signInHref } from "@/features/auth/edge";
import { replaceDocument } from "@/lib/navigation";

import { selectPlayer } from "../api/profile-browser-api";
import { PLAYERS_PATH } from "../model/players";

/** `switching` while the choice is sent, `failed` when it was not taken. */
export type SwitchStatus = "idle" | "switching" | "failed";

/**
 * Makes the chosen player active, then loads the map as a new document: every
 * screen the router has cached, and the progress on it, was the other
 * child's, so none of it may be reused (ADR 0007). A `401` goes to sign in,
 * back to the picker. Any other failure keeps the child on the picker, with a
 * message; choosing again is a retry, which is safe, since choosing is
 * idempotent. A choice made while one is being sent is ignored.
 */
export function useSwitchPlayer(): {
  status: SwitchStatus;
  switchTo: (playerId: string) => void;
} {
  const [status, setStatus] = useState<SwitchStatus>("idle");
  // Set at once, unlike `status`, so a double tap sends one choice.
  const isSwitching = useRef(false);

  const switchTo = useCallback((playerId: string) => {
    if (isSwitching.current) {
      return;
    }
    isSwitching.current = true;
    setStatus("switching");
    selectPlayer(playerId).then(
      () => replaceDocument(PLAY_PATH),
      (error: unknown) => {
        if (error instanceof ApiClientError && error.status === 401) {
          replaceDocument(signInHref(PLAYERS_PATH));
          return;
        }
        isSwitching.current = false;
        setStatus("failed");
      },
    );
  }, []);

  return { status, switchTo };
}
