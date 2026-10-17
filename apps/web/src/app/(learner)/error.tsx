"use client";

import { ErrorFallback } from "@/components/ui/ErrorFallback";

type LearnerErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

// Calm, and clear that nothing the learner did caused it: no "check your
// connection", which would put the problem on them or their device.
export default function LearnerError({ reset }: LearnerErrorProps) {
  return (
    <ErrorFallback
      title="This page didn’t open."
      description="Something went wrong on our side. Let’s try again."
      size="large"
      reset={reset}
    />
  );
}
