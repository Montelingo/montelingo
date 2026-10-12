"use client";

import { FormAlert } from "@/components/ui/FormAlert";
import { cn } from "@/lib/cn";
import { replaceDocument } from "@/lib/navigation";

import { useSignOut } from "../hooks/use-sign-out";
import { HOME_PATH } from "../model/routes";

export function SignOutButton() {
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
          "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
          isPending ? "cursor-wait hover:bg-white" : undefined,
        )}
      >
        {/* Both labels share one grid cell, so the button keeps the width of
            the longer one and nothing in the header moves when it changes. */}
        <span className="grid">
          <span
            aria-hidden={isPending || undefined}
            className={cn(
              "col-start-1 row-start-1",
              isPending ? "invisible" : undefined,
            )}
          >
            Sign out
          </span>
          <span
            aria-hidden={!isPending || undefined}
            className={cn(
              "col-start-1 row-start-1",
              isPending ? undefined : "invisible",
            )}
          >
            Signing out…
          </span>
        </span>
      </button>
      {/* Floats below the button, so it does not push the header around. */}
      <FormAlert
        message={error}
        className="absolute right-0 top-full z-10 mt-2 w-64"
      />
    </div>
  );
}
