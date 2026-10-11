import Link from "next/link";

import { cn } from "@/lib/cn";

import { ACCOUNT_PATH, SIGN_IN_PATH, SIGN_UP_PATH } from "../model/routes";
import type { AuthState } from "../model/user";
import { linkClassName } from "./link-class-name";
import { SignOutButton } from "./SignOutButton";

type AuthNavProps = {
  state: AuthState;
};

// The header's account controls. When the lookup failed, the browser does have
// a session cookie (without one there is nothing to look up, and the state is
// signed-out), so only "Sign out" is shown: not "Sign in", which would tell a
// signed-in user they are signed out and could leave a live session behind on
// a shared device, and not an email nobody has verified.
export function AuthNav({ state }: AuthNavProps) {
  switch (state.status) {
    case "signed-in":
      return (
        <nav aria-label="Account">
          <ul className="flex items-center gap-4">
            <li className="min-w-0">
              <Link
                href={ACCOUNT_PATH}
                className={cn(
                  linkClassName,
                  "block max-w-40 truncate text-sm sm:max-w-xs",
                )}
                // Truncated on narrow screens, so the full address is one hover away.
                title={state.user.email}
              >
                {state.user.email}
              </Link>
            </li>
            <li>
              <SignOutButton />
            </li>
          </ul>
        </nav>
      );
    case "signed-out":
      return (
        <nav aria-label="Account">
          <ul className="flex items-center gap-4">
            <li>
              <Link
                href={SIGN_IN_PATH}
                className={cn(linkClassName, "text-sm")}
              >
                Sign in
              </Link>
            </li>
            <li>
              <Link
                href={SIGN_UP_PATH}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Sign up
              </Link>
            </li>
          </ul>
        </nav>
      );
    case "unavailable":
      return (
        <nav aria-label="Account">
          <SignOutButton />
        </nav>
      );
  }
}
