"use client";

import { ErrorFallback } from "@/components/ui/ErrorFallback";

type WelcomeErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Inside the welcome frame, so a failed page keeps the art and the panel.
export default function WelcomeError({ reset }: WelcomeErrorProps) {
  return (
    <ErrorFallback
      title="Stranica se nije otvorila."
      description="Provjeri internet vezu i pokušaj ponovo."
      retryLabel="Pokušaj ponovo"
      size="large"
      reset={reset}
    />
  );
}
