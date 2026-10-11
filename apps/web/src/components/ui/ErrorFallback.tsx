"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";

type ErrorFallbackProps = {
  /** What could not be shown, such as "We couldn’t load this page." */
  title: string;
  /** The `reset` an `error.tsx` boundary receives. */
  reset: () => void;
};

// The body of a route's error.tsx: a message and a retry action. It never
// shows the error's own message, which may carry server details.
export function ErrorFallback({ title, reset }: ErrorFallbackProps) {
  const router = useRouter();

  // reset() alone re-renders the boundary with the same Server Component
  // payload; refreshing first fetches it again, so a passing failure can recover.
  function handleRetry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div role="alert" className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="text-slate-700">
        Check your connection and try again in a moment.
      </p>
      <button
        type="button"
        onClick={handleRetry}
        className="inline-flex items-center justify-center rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        Try again
      </button>
    </div>
  );
}
