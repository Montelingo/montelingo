import type { Metadata } from "next";

import {
  InvalidResetLink,
  parseResetToken,
  ResetPasswordForm,
} from "@/features/auth";

// The URL carries the reset token, so it must never leave in a Referer header
// or reach a search index. next.config.ts also sends both policies as response
// headers, which apply before the browser reaches these tags.
export const metadata: Metadata = {
  title: "Choose a new password",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

// Signed-in users are not redirected: the link must work whoever is signed in.
// The token is only read here. The API checks and uses it up when the form is
// submitted, never on page load, which mail link scanners also trigger.
export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const token = parseResetToken((await searchParams).token);

  if (token === null) {
    return <InvalidResetLink />;
  }

  return <ResetPasswordForm token={token} />;
}
