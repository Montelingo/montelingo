"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ACTION_SIZE_STYLES, ACTION_STYLE } from "@/components/ui/action-style";
import { cn } from "@/lib/cn";

import { ScreenNotice } from "./ScreenNotice";

const STILL_NOT_LOADED = "Still not loaded. Try again in a moment.";

// Shown when the server has not given a place its state: progress failed, or
// had no entry for it. The cards still show every place, marked "Not loaded"
// or "Loading", and nothing can be opened until progress loads. Like
// (learner)/error.tsx, it puts the problem on our side, never on the learner
// or their device. Retrying refreshes the route, which reads progress again.
export function ProgressErrorNotice() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [wasPending, setWasPending] = useState(false);
  const [failedRetries, setFailedRetries] = useState(0);

  // A retry has finished when isPending goes from true to false. Had it
  // worked, the screen would have dropped this notice; still here, it failed.
  // Tracked during render, not in an effect, so the line appears with the
  // refreshed screen instead of a render later.
  if (isPending !== wasPending) {
    setWasPending(isPending);
    if (!isPending) {
      setFailedRetries((count) => count + 1);
    }
  }

  function handleRetry() {
    if (isPending) {
      return;
    }
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <ScreenNotice message="Your places didn’t load. Something went wrong on our side. Let’s try again.">
      {/* Like SubmitButton while pending: focusable, marked, and ignoring taps. */}
      <button
        type="button"
        onClick={handleRetry}
        aria-disabled={isPending ? "true" : undefined}
        className={cn(ACTION_STYLE, ACTION_SIZE_STYLES.large)}
      >
        Try again
      </button>
      {/* Seen here, heard once from the status region below. Hidden while a
          retry runs, so the answer to each one shows anew. */}
      {failedRetries > 0 && !isPending ? (
        <p aria-hidden="true" className="text-lg text-ink">
          {STILL_NOT_LOADED}
        </p>
      ) : null}
      {/* Always mounted, so screen readers are already watching it. Each
          failed retry inserts a new node, which announces the same words
          again. */}
      <span role="status" className="sr-only">
        {failedRetries > 0 ? (
          <span key={failedRetries}>{STILL_NOT_LOADED}</span>
        ) : null}
      </span>
    </ScreenNotice>
  );
}
