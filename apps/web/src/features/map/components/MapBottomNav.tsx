import Link from "next/link";

import { FOCUS_RING } from "@/components/ui/kid-styles";
import { PLAY_PATH } from "@/features/auth/edge";
import { cn } from "@/lib/cn";

import { ME_PATH, PRIZES_PATH, WORDS_PATH } from "../model/paths";
import { ChromeIcon, type ChromeIconName } from "./ChromeIcon";

/** The tabs, each with its page. */
export type NavTab = "map" | "words" | "prizes" | "me";

type Tab = {
  id: NavTab;
  label: string;
  icon: ChromeIconName;
  href: string;
};

const TABS: readonly Tab[] = [
  { id: "map", label: "Mapa", icon: "map", href: PLAY_PATH },
  { id: "words", label: "Riječi", icon: "words", href: WORDS_PATH },
  { id: "prizes", label: "Nagrade", icon: "prizes", href: PRIZES_PATH },
  { id: "me", label: "Ja", icon: "me", href: ME_PATH },
];

type MapBottomNavProps = {
  /** The tab whose page this is, drawn on the yellow chip. */
  current: NavTab;
};

// The kid tab bar (Figma "Bottom nav"): docked to the bottom edge on phones
// and portrait tablets, floating in the bottom middle from 1024px wide. The
// current tab sits on a yellow chip.
export function MapBottomNav({ current }: MapBottomNavProps) {
  return (
    <nav
      aria-label="Glavni meni"
      className="pointer-events-auto flex items-center justify-between rounded-t-kid-lg border-t-3 border-kid-ink bg-white px-3.5 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] pt-2.5 lg:w-bottom-nav lg:rounded-kid-lg lg:pb-2.5"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === current ? "page" : undefined}
          className={cn(
            "flex min-w-touch-lg flex-col items-center justify-center gap-0.5 rounded-kid-sm border-3 px-3.5 py-1.5 font-semibold leading-tight",
            FOCUS_RING,
            tab.id === current
              ? "border-kid-ink bg-kid-yellow text-kid-ink"
              : "border-transparent text-kid-muted",
          )}
        >
          <ChromeIcon name={tab.icon} size={30} />
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
