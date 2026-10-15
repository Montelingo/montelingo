import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  parseSignInNotice,
  postAuthRedirectPath,
  SignInForm,
} from "@/features/auth";
import { getAuthState } from "@/features/auth/server";

export const metadata: Metadata = {
  title: "Sign in",
};

type SignInPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    notice?: string | string[];
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { next, notice } = await searchParams;
  const redirectTo = postAuthRedirectPath(next);
  const signInNotice = parseSignInNotice(notice);

  // A notice is shown even to a signed-in user: someone who reset another
  // account's password in this browser must see it, and signing in as that
  // account replaces the session. A failed session check counts as signed
  // out, so the visitor gets the form rather than an error page. If the API
  // is down, submitting it says so.
  if (signInNotice === null && (await getAuthState()).status === "signed-in") {
    redirect(redirectTo);
  }

  return <SignInForm redirectTo={redirectTo} notice={signInNotice} />;
}
