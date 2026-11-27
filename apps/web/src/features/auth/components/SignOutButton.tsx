"use client";

import { FormAlert } from "@/components/ui/FormAlert";
import { SMALL_LINK } from "@/components/ui/kid-styles";
import { cn } from "@/lib/cn";
import { replaceDocument } from "@/lib/navigation";

import { authErrorMessages } from "../errors";
import { useSignOut } from "../hooks/use-sign-out";
import { HOME_PATH } from "../model/routes";
import { PendingLabel } from "./PendingLabel";

// The places that sign out at once, each with its own look and language: the
// site header (still in English, #153 leaves it) and the welcome screens'
// small links, in Montenegrin. The grown-ups area asks first: SignOutConfirm.
const APPEARANCES = {
  site: {
    label: "Sign out",
    pendingLabel: "Signing out…",
    failure: authErrorMessages.signOutFailedEnglish,
    button: cn(
      "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
    ),
    pendingButton: "hover:bg-white",
    // Floats below the header's button, so it does not push the header around.
    alert: "absolute right-0 top-full z-10 mt-2 w-64",
  },
  welcome: {
    label: "Odjavi se",
    pendingLabel: "Odjavljujem…",
    failure: authErrorMessages.signOutFailed,
    button: SMALL_LINK,
    pendingButton: undefined,
    alert: "mt-2",
  },
} as const;

type SignOutButtonProps = {
  /** Where the button sits. The site header's by default. */
  appearance?: keyof typeof APPEARANCES;
};

export function SignOutButton({ appearance = "site" }: SignOutButtonProps) {
  const copy = APPEARANCES[appearance];
  const { isPending, error, signOut } = useSignOut({
    // A full load of the home page, not router.replace() + refresh(): it drops
    // every bit of the signed-in user's client state (including the router
    // cache, which would otherwise serve protected pages on Back), it cannot
    // leave this button stuck if a soft refresh fails, and focus starts over
    // at the top of the new page instead of falling to <body>.
    onSignedOut: () => replaceDocument(HOME_PATH),
  });

  return (
    <div className="relative">
      {/* aria-disabled keeps the button focusable while pending, so focus is
          not lost; the hook ignores clicks until the call has finished. */}
      <button
        type="button"
        aria-disabled={isPending || undefined}
        onClick={signOut}
        className={cn(
          copy.button,
          isPending ? ["cursor-wait", copy.pendingButton] : undefined,
        )}
      >
        <PendingLabel
          label={copy.label}
          pendingLabel={copy.pendingLabel}
          isPending={isPending}
        />
      </button>
      <FormAlert
        message={error === null ? null : copy.failure}
        className={copy.alert}
      />
    </div>
  );
}
