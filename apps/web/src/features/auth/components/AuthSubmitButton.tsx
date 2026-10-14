"use client";

import type { ReactNode } from "react";

import { SubmitButton } from "@/components/ui/SubmitButton";
import { useIsHydrated } from "@/lib/use-is-hydrated";

import { formatCountdown } from "../model/form-state";

type AuthSubmitButtonProps = {
  children: ReactNode;
  isPending: boolean;
  /** Shown while the API call is in flight, such as "Signing in…". */
  pendingLabel: string;
  /** Seconds left before the API accepts another attempt, or `null`. */
  retryAfterSeconds: number | null;
};

// Held (aria-disabled, still focusable) while the call is in flight and while
// the API's Retry-After runs, counting down so the wait is visible on the button.
//
// Disabled until the page hydrates: before then no handler is attached, and a
// native submit would post the values to the page route and lose them. A
// disabled default button blocks both clicks and Enter in a field (implicit
// submission), which aria-disabled cannot do without JavaScript.
export function AuthSubmitButton({
  children,
  isPending,
  pendingLabel,
  retryAfterSeconds,
}: AuthSubmitButtonProps) {
  const isHydrated = useIsHydrated();
  const isHeld = retryAfterSeconds !== null;

  return (
    <SubmitButton
      disabled={!isHydrated}
      pending={isPending || isHeld}
      pendingLabel={
        isHeld
          ? `Try again in ${formatCountdown(retryAfterSeconds)}`
          : pendingLabel
      }
    >
      {children}
    </SubmitButton>
  );
}
