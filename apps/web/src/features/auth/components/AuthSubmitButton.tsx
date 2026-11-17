"use client";

import type { ReactNode } from "react";

import { BIG_BUTTON } from "@/components/ui/kid-styles";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { cn } from "@/lib/cn";
import { useIsHydrated } from "@/lib/use-is-hydrated";

import { formatCountdown } from "../model/form-state";
import { retryIn } from "../model/messages";

type AuthSubmitButtonProps = {
  children: ReactNode;
  isPending: boolean;
  /** Shown while the API call is in flight, such as "Prijavljujem…". */
  pendingLabel: string;
  /** Seconds left before the API accepts another attempt, or `null`. */
  retryAfterSeconds: number | null;
  /** The site's button (the default), or the kit's yellow one for the welcome screens. */
  appearance?: "site" | "kid";
};

// The kit's yellow button with the raised edge. Held or disabled, it keeps its
// colours and only fades, over the site button's own pending and disabled ones.
const KID_BUTTON = cn(
  BIG_BUTTON,
  "bg-kid-yellow px-4 hover:bg-kid-yellow",
  "disabled:bg-kid-yellow disabled:text-kid-ink disabled:opacity-60",
  "aria-disabled:opacity-80",
);

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
  appearance = "site",
}: AuthSubmitButtonProps) {
  const isHydrated = useIsHydrated();
  const isHeld = retryAfterSeconds !== null;

  return (
    <SubmitButton
      className={appearance === "kid" ? KID_BUTTON : undefined}
      disabled={!isHydrated}
      pending={isPending || isHeld}
      pendingLabel={
        isHeld ? retryIn(formatCountdown(retryAfterSeconds)) : pendingLabel
      }
    >
      {children}
    </SubmitButton>
  );
}
