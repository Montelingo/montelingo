"use client";

import { useRef, useState } from "react";

import { signOut } from "../api/auth-api";
import { authErrorMessages } from "../errors";

type SignOutState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "error"; message: string };

type UseSignOutOptions = {
  /** Runs once the API has ended the session, or found it already ended. */
  onSignedOut: () => void;
};

/**
 * Runs sign-out. An expired session (`401`) counts as signed out, because
 * `signOut()` resolves for it. After any other failure it is unknown whether
 * the session ended (the API may have revoked it and the response got lost),
 * so the failure is reported rather than hidden by a navigation, and the user
 * can try again. A retry on an ended session gets `401`, which succeeds.
 *
 * Stays pending after success: the caller loads another page, so the control
 * must not be usable again in the meantime.
 */
export function useSignOut({ onSignedOut }: UseSignOutOptions) {
  const [state, setState] = useState<SignOutState>({ status: "idle" });
  // State updates land on the next render, so a quick second click could
  // still see "idle". The ref blocks it at once.
  const isInFlightRef = useRef(false);

  function handleSignOut() {
    if (isInFlightRef.current) {
      return;
    }
    isInFlightRef.current = true;
    setState({ status: "pending" });
    void runSignOut();
  }

  async function runSignOut() {
    try {
      await signOut();
    } catch {
      isInFlightRef.current = false;
      setState({ status: "error", message: authErrorMessages.signOutFailed });
      return;
    }
    onSignedOut();
  }

  return {
    /** True while the API call is in flight, and after it succeeds. */
    isPending: state.status === "pending",
    /**
     * What went wrong on the last attempt, or `null`. Cleared while a retry is
     * in flight, so an alert showing it mounts again and is announced again.
     */
    error: state.status === "error" ? state.message : null,
    signOut: handleSignOut,
  };
}
