import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { postAuthRedirectPath, SignUpForm } from "@/features/auth";
import { getAuthState } from "@/features/auth/server";

export const metadata: Metadata = {
  title: "Sign up",
};

type SignUpPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { next } = await searchParams;
  const redirectTo = postAuthRedirectPath(next);

  // A failed session check counts as signed out, so the visitor gets the form
  // rather than an error page. If the API is down, submitting it says so.
  if ((await getAuthState()).status === "signed-in") {
    redirect(redirectTo);
  }

  return <SignUpForm redirectTo={redirectTo} />;
}
