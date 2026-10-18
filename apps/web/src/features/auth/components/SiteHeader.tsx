import "server-only";

import Link from "next/link";
import { Suspense, use } from "react";

import { getAuthState } from "../api/session";
import { HOME_PATH } from "../model/routes";
import type { AuthState } from "../model/user";
import { AuthNav } from "./AuthNav";
import { AuthNavSkeleton } from "./AuthNavSkeleton";

// The site's header, on every page outside the learner area ((site)/layout.tsx
// and the root not-found page). The shell renders at once; only the
// account controls wait for the session lookup, inside their own Suspense
// boundary, so a slow API never holds the page. getAuthState() never throws
// for a failed lookup, and shares its call with the page through React cache().
export function SiteHeader() {
  // Started here, awaited inside the boundary, so it runs alongside the page.
  const authState = getAuthState();

  return (
    <header className="border-b border-slate-200 bg-white/80">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link
          href={HOME_PATH}
          className="shrink-0 rounded-sm text-lg font-bold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Montelingo
        </Link>
        <Suspense fallback={<AuthNavSkeleton />}>
          <ResolvedAuthNav authState={authState} />
        </Suspense>
      </div>
    </header>
  );
}

function ResolvedAuthNav({ authState }: { authState: Promise<AuthState> }) {
  return <AuthNav state={use(authState)} />;
}
