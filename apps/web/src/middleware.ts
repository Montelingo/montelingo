import { type NextRequest, NextResponse } from "next/server";

import { getSessionCookieName, signInRedirectFor } from "@/features/auth/edge";

// Sends a request for a protected page without a session cookie straight to
// sign-in. Only a fast path: the cookie can be stale, so protected pages still
// check the session with getCurrentUser().
export function middleware(request: NextRequest) {
  const target = signInRedirectFor({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    hasSessionCookie: request.cookies.has(getSessionCookieName()),
  });
  if (target === null) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL(target, request.url));
}

// Next.js reads the matcher at build time, so it must be a literal. List each
// of PROTECTED_PATH_PREFIXES as `<path>/:path*` (which also matches `<path>`);
// middleware.test.ts checks that the two agree.
export const config = {
  matcher: ["/account/:path*"],
};
