"use client";

import { useEffect, useState } from "react";

import { heartsText } from "../model/hearts";
import { ChromeIcon } from "./ChromeIcon";

// Screen readers speak what changes in a live region, not what it held when
// it appeared, so the line goes in a moment after mount, as in SaveNotice.
const ANNOUNCE_DELAY_MS = 100;

// "+1 srce" with the heart, on the "Bravo!" screen of a replayed lesson or
// game that earned a heart (ADR 0009). It comes when the save answers, so it
// may appear after the screen does. Nothing shows when no heart was earned:
// the child is never told about the daily cap.
export function HeartNotice() {
  const [isAnnounced, setIsAnnounced] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setIsAnnounced(true),
      ANNOUNCE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  const text = heartsText(1);
  return (
    <div className="flex w-full justify-center">
      <p
        aria-hidden="true"
        className="inline-flex items-center gap-1.5 rounded-badge border-3 border-kid-ink bg-white py-1.5 pl-2 pr-3.5 text-xl font-semibold text-kid-ink shadow-raised-4"
      >
        <ChromeIcon name="heart" size={26} />
        {text}
      </p>
      <span role="status" className="sr-only">
        {isAnnounced ? text : null}
      </span>
    </div>
  );
}
