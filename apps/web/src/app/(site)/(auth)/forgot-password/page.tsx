import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Forgot your password?",
};

// Signed-in users are not redirected: with no change-password page, someone
// who forgot their password while still signed in may need a link too. The
// page also renders without calling the API.
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
