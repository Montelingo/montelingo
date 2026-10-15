import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ACCOUNT_PATH, AccountOverview, signInHref } from "@/features/auth";
import { getCurrentUser } from "@/features/auth/server";

export const metadata: Metadata = {
  title: "Account",
};

// The reference for protected pages. The middleware already sent visitors
// without a session cookie to sign in, but a cookie can be stale, so the page
// checks the session itself. A failed check throws to error.tsx: it must not
// look like "signed out", or the page would bounce a signed-in user to sign-in.
export default async function AccountPage() {
  const user = await getCurrentUser();

  if (user === null) {
    redirect(signInHref(ACCOUNT_PATH));
  }

  return <AccountOverview user={user} />;
}
