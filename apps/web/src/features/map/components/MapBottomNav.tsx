"use client";

import Link from "next/link";
import { useState } from "react";

import { PLAY_PATH } from "@/features/auth/edge";
import { cn } from "@/lib/cn";

import { ChromeIcon, type ChromeIconName } from "./ChromeIcon";
import { FOCUS_RING } from "./chrome-styles";

type Tab = { id: string; label: string; icon: ChromeIconName };

// Map is the only tab with a page so far; the others are drawn, and say they
// are coming when tapped.
const TABS: readonly Tab[] = [
  { id: "map", label: "Mapa", icon: "map" },
  { id: "words", label: "Riječi", icon: "words" },
  { id: "prizes", label: "Nagrade", icon: "prizes" },
  { id: "me", label: "Ja", icon: "me" },
];

const TAB_CLASS = cn(
  "flex min-w-touch-lg flex-col items-center justify-center gap-0.5 rounded-kid-sm border-3 px-3.5 py-1.5 font-semibold leading-tight",
  FOCUS_RING,
);

// The kid tab bar (Figma "Bottom nav"): docked to the bottom edge on phones
// and portrait tablets, floating in the bottom middle from 1024px wide. The
// active tab sits on a yellow chip.
export function MapBottomNav() {
  const [message, setMessage] = useState<{ text: string; key: number } | null>(
    null,
  );

  function sayComing(label: string) {
    setMessage((previous) => ({
      text: `${label}: uskoro!`,
      key: (previous?.key ?? 0) + 1,
    }));
  }

  return (
    <>
      <nav
        aria-label="Glavni meni"
        className="pointer-events-auto flex items-center justify-between rounded-t-kid-lg border-t-3 border-kid-ink bg-white px-3.5 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] pt-2.5 lg:w-[32.5rem] lg:rounded-kid-lg lg:pb-2.5"
      >
        {TABS.map((tab) =>
          tab.id === "map" ? (
            <Link
              key={tab.id}
              href={PLAY_PATH}
              aria-current="page"
              className={cn(
                TAB_CLASS,
                "border-kid-ink bg-kid-yellow text-kid-ink",
              )}
            >
              <ChromeIcon name={tab.icon} size={30} />
              {tab.label}
            </Link>
          ) : (
            <button
              key={tab.id}
              type="button"
              aria-disabled="true"
              onClick={() => sayComing(tab.label)}
              className={cn(TAB_CLASS, "border-transparent text-kid-muted")}
            >
              <ChromeIcon name={tab.icon} size={30} />
              {tab.label}
            </button>
          ),
        )}
      </nav>
      {/* Always mounted, so screen readers are already watching it. */}
      <p
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-44 z-30 flex justify-center lg:bottom-32"
      >
        {message !== null ? (
          <span
            key={message.key}
            className="rounded-badge border-3 border-kid-ink bg-white px-4 py-2 text-lg font-semibold text-kid-ink shadow-raised-4"
          >
            {message.text}
          </span>
        ) : null}
      </p>
    </>
  );
}
