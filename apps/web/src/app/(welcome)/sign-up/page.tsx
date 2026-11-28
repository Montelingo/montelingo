import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { postAuthRedirectPath, SignUpForm } from "@/features/auth";
import { getAuthState } from "@/features/auth/server";
import { getPrivacyPolicyVersion } from "@/features/privacy/server";

export const metadata: Metadata = {
  title: "Napravi nalog",
};

type SignUpPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { next } = await searchParams;
  const redirectTo = postAuthRedirectPath(next);

  // Both reads run at once, and neither throws. A failed session check counts
  // as signed out, so the visitor gets the form rather than an error page. If
  // the API is down, submitting it says so.
  const [authState, privacyPolicyVersion] = await Promise.all([
    getAuthState(),
    getPrivacyPolicyVersion(),
  ]);
  if (authState.status === "signed-in") {
    redirect(redirectTo);
  }

  return (
    <SignUpForm
      redirectTo={redirectTo}
      privacyPolicyVersion={privacyPolicyVersion}
    />
  );
}
