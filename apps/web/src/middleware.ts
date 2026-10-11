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
  // Built on nextUrl, the router's parsed view of this request, rather than
  // request.url. Behind a proxy the server's own origin (such as 0.0.0.0:3000)
  // is the same in both; Next.js turns a redirect to that origin into a
  // relative Location, so the browser stays on the public host.
  const url = request.nextUrl.clone();
  const destination = new URL(target, url);
  url.pathname = destination.pathname;
  url.search = destination.search;
  return NextResponse.redirect(url);
}

// Next.js reads the matcher at build time, so it must be a literal. List each
// of PROTECTED_PATH_PREFIXES as `<path>/:path*` (which also matches `<path>`);
// middleware.test.ts checks that the two agree.
export const config = {
  matcher: ["/account/:path*"],
};
