"use client";

import { ErrorFallback } from "@/components/ui/ErrorFallback";

type AuthErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AuthError({ reset }: AuthErrorProps) {
  return (
    <ErrorFallback
      title="Stranica se nije otvorila."
      description="Provjeri internet vezu i pokušaj ponovo."
      retryLabel="Pokušaj ponovo"
      reset={reset}
    />
  );
}
