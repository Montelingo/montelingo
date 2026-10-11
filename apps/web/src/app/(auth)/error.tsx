"use client";

import { ErrorFallback } from "@/components/ui/ErrorFallback";

type AuthErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AuthError({ reset }: AuthErrorProps) {
  return <ErrorFallback title="We couldn’t load this page." reset={reset} />;
}
