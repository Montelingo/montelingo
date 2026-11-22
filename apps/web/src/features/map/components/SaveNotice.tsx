"use client";

import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { useEffect, useRef, useState } from "react";

import { FOCUS_RING } from "@/components/ui/kid-styles";
import { cn } from "@/lib/cn";

import type { SaveStatus } from "../hooks/use-save-result";

export const SAVE_NOTICE_COPY = {
  failed: "Ovo još nije sačuvano.",
  saving: "Čuvam…",
  saved: "Sačuvano!",
  retry: "Pokušaj ponovo",
} as const;

// Screen readers speak what changes in a live region, not what it held when
// it appeared, so the first message goes in a moment after mount.
const ANNOUNCE_DELAY_MS = 100;

export type SaveNoticeProps = {
  /** The save's status: render the notice once a save has failed. */
  status: SaveStatus;
  onRetry: () => void;
};

// A calm note on the "Bravo!" screen when the result did not save: neutral
// colours, never an alarm, and a retry. The child stays on the screen. While
// the retry runs, the button waits (aria-disabled, so it keeps the focus);
// once it saves, the note says so, and the focus moves from the button, which
// is gone, to the note's status line. The copy is Montenegrin, like the screen around it.
export function SaveNotice({ status, onRetry }: SaveNoticeProps) {
  const [isAnnounced, setIsAnnounced] = useState(false);
  const statusRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hadFocus = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setIsAnnounced(true),
      ANNOUNCE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  const isSaved = status === "saved";
  useEffect(() => {
    if (isSaved && hadFocus.current) {
      statusRef.current?.focus();
    }
  }, [isSaved]);

  const message = isSaved
    ? SAVE_NOTICE_COPY.saved
    : status === "saving"
      ? SAVE_NOTICE_COPY.saving
      : SAVE_NOTICE_COPY.failed;

  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-kid-lg border-3 border-kid-ink bg-white p-4 text-center">
      <p aria-hidden="true" className="text-xl font-semibold">
        {message}
      </p>
      {/* Always mounted, so screen readers are already watching it. It takes
          the focus from the retry button once that is gone. */}
      <span ref={statusRef} tabIndex={-1} role="status" className="sr-only">
        {isAnnounced ? message : null}
      </span>
      {isSaved ? null : (
        <button
          ref={buttonRef}
          type="button"
          aria-disabled={status === "saving"}
          onClick={() => {
            if (status === "failed") {
              hadFocus.current = document.activeElement === buttonRef.current;
              onRetry();
            }
          }}
          className={cn(
            "inline-flex min-h-touch-lg items-center gap-2 rounded-full border-3 border-kid-ink bg-kid-yellow px-6 text-xl font-semibold text-kid-ink shadow-raised-4",
            "aria-disabled:cursor-default aria-disabled:opacity-60 aria-disabled:shadow-none",
            FOCUS_RING,
          )}
        >
          <ArrowPathIcon aria-hidden="true" className="size-6" />
          {SAVE_NOTICE_COPY.retry}
        </button>
      )}
    </div>
  );
}
