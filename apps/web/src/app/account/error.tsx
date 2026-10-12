"use client";

import { ErrorFallback } from "@/components/ui/ErrorFallback";

type AccountErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AccountError({ reset }: AccountErrorProps) {
  return <ErrorFallback title="We couldn’t load your account." reset={reset} />;
}
