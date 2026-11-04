"use client";

import { InformationCircleIcon } from "@heroicons/react/24/solid";
import { type ReactNode, useEffect, useRef, useState } from "react";

// Screen readers start watching a live region when it appears and speak what
// changes in it afterwards, not what it held when it appeared. The message is
// inserted a moment after mount, so it is spoken on a full load and after a
// client-side redirect alike.
const ANNOUNCE_DELAY_MS = 100;

type ScreenNoticeProps = {
  /** Plain words, such as why the learner was sent back here. */
  message: string;
  /** An action under the message, such as a retry button. */
  children?: ReactNode;
  /**
   * Called once, when the message has been put in the status region: for a
   * notice that should not come back, such as one read from the URL.
   */
  onAnnounce?: () => void;
};

// A calm note at the top of a map screen: neutral colours, never an alarm.
// The visible text is hidden from assistive technology, which hears the same
// words once, from the polite status region.
export function ScreenNotice({
  message,
  children,
  onAnnounce,
}: ScreenNoticeProps) {
  const [isAnnounced, setIsAnnounced] = useState(false);

  // The latest onAnnounce, so a new one on a later render neither restarts the
  // delay nor is missed. Not useEffectEvent(): the React that Next.js 15 ships
  // for the App Router does not export it yet.
  const onAnnounceRef = useRef(onAnnounce);
  useEffect(() => {
    onAnnounceRef.current = onAnnounce;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsAnnounced(true);
      onAnnounceRef.current?.();
    }, ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-start gap-4 rounded-tile border-2 border-ink-muted bg-surface-muted p-4">
      <div className="flex items-start gap-3">
        <InformationCircleIcon
          aria-hidden="true"
          className="size-8 shrink-0 text-ink"
        />
        <p aria-hidden="true" className="text-lg font-medium text-ink">
          {message}
        </p>
      </div>
      {/* Always mounted, so screen readers are already watching it. */}
      <span role="status" className="sr-only">
        {isAnnounced ? message : null}
      </span>
      {children}
    </div>
  );
}
