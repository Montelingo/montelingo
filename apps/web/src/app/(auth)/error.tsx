"use client";

import { useRouter } from "next/navigation";
import { startTransition } from "react";

type AuthErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AuthError({ reset }: AuthErrorProps) {
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
      <h1 className="text-2xl font-bold text-slate-900">
        We couldn’t load this page.
      </h1>
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
