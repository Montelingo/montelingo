import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  PLAY_PATH,
  REQUESTED_PATH_HEADER,
  requestedPathWithin,
  signInHref,
} from "@/features/auth";
import { getCurrentUser } from "@/features/auth/server";

type PlayLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

// The session check for everything under /play. The middleware already sent
// visitors without a session cookie to sign in, but a cookie can be stale.
// A failed check throws to (learner)/error.tsx, which can catch it only
// because this layout is a level below the group's: an error boundary never
// catches its own segment's layout.
//
// A layout cannot read its URL, so the middleware hands it the requested path
// in REQUESTED_PATH_HEADER, and sign-in returns there (or to /play).
//
// Layouts do not run again on client-side navigation inside /play, so this is
// the gate for full loads only: the pages' own data requests must still treat
// a 401 as signed out.
export default async function PlayLayout({ children }: PlayLayoutProps) {
  const user = await getCurrentUser();

  if (user === null) {
    const requestedPath = (await headers()).get(REQUESTED_PATH_HEADER);
    redirect(signInHref(requestedPathWithin(PLAY_PATH, requestedPath)));
  }

  return children;
}
