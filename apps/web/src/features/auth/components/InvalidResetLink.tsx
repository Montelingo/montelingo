"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { FORGOT_PASSWORD_PATH, SIGN_IN_PATH } from "../model/routes";
import { linkClassName } from "./link-class-name";

type InvalidResetLinkProps = {
  /**
   * Moves focus to the heading when this replaces the form after a submit, so
   * screen readers announce the change. Not on page load, where focus starts
   * at the top of the page anyway.
   */
  focusOnMount?: boolean;
};

// The way out of a reset link that is missing, malformed, used, or expired. It
// never links back with the token: a new link is the only fix.
export function InvalidResetLink({
  focusOnMount = false,
}: InvalidResetLinkProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusOnMount) {
      headingRef.current?.focus();
    }
  }, [focusOnMount]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1
          ref={headingRef}
          tabIndex={focusOnMount ? -1 : undefined}
          className="text-2xl font-bold text-slate-900 focus:outline-none"
        >
          This reset link doesn’t work
        </h1>
        <p className="text-slate-700">
          Reset links can be used once and expire after a short time. Request a
          new link to choose a new password.
        </p>
      </div>
      <Link
        href={FORGOT_PASSWORD_PATH}
        className="inline-flex items-center justify-center rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Request a new link
      </Link>
      <p className="text-center text-sm text-slate-700">
        <Link href={SIGN_IN_PATH} className={linkClassName}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
