import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  parseSignInNotice,
  postAuthRedirectPath,
  SignInForm,
} from "@/features/auth";
import { getCurrentUser } from "@/features/auth/server";

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

  if ((await getCurrentUser()) !== null) {
    redirect(redirectTo);
  }

  return (
    <SignInForm redirectTo={redirectTo} notice={parseSignInNotice(notice)} />
  );
}
