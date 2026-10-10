import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { postAuthRedirectPath, SignUpForm } from "@/features/auth";
import { getCurrentUser } from "@/features/auth/server";

export const metadata: Metadata = {
  title: "Sign up",
};

type SignUpPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { next } = await searchParams;
  const redirectTo = postAuthRedirectPath(next);

  if ((await getCurrentUser()) !== null) {
    redirect(redirectTo);
  }

  return <SignUpForm redirectTo={redirectTo} />;
}
