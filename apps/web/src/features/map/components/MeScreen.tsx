import { ChevronRightIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";

import { FOCUS_RING } from "@/components/ui/kid-styles";
import { GrownUpsGateButton } from "@/features/grown-ups";
import { avatarSrc, PLAYERS_PATH } from "@/features/profile/edge";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import type { MeData } from "../model/me";
import { GROWN_UPS_PATH } from "../model/paths";
import { ChromeIcon, type ChromeIconName } from "./ChromeIcon";
import { MapBottomNav } from "./MapBottomNav";
import { ProgressErrorNotice } from "./ProgressErrorNotice";

type Tile = {
  /** Spoken before the count, as the top bar's counters do. */
  label: string;
  /** Shown under the count, as in Figma. */
  caption: string;
  icon: ChromeIconName;
  /** The tile's soft fill and its icon chip's strong one, written out. */
  tileClass: string;
  chipClass: string;
};

const STARS: Tile = {
  label: "Zvjezdice",
  caption: "zvjezdice",
  icon: "star",
  tileClass: "bg-kid-yellow-soft",
  chipClass: "bg-kid-yellow",
};
const HEARTS: Tile = {
  label: "Srca",
  caption: "srca",
  icon: "heart",
  // Until Figma has the tile: the stars tile's shape, in the heart's coral.
  tileClass: "bg-kid-fog",
  chipClass: "bg-kid-coral",
};
const WORDS: Tile = {
  label: "Riječi",
  caption: "riječi",
  icon: "words",
  tileClass: "bg-kid-sea-soft",
  chipClass: "bg-kid-sea",
};
const STICKERS: Tile = {
  label: "Naljepnice",
  caption: "naljepnice",
  icon: "prizes",
  tileClass: "bg-kid-pink-soft",
  chipClass: "bg-kid-pink",
};

// A wide row with the ink edge: Switch player's link, or the grown-ups gate's
// button.
const ROW_CLASS = cn(
  "flex min-h-touch-lg items-center gap-4 rounded-kid-xl border-3 border-kid-ink bg-white px-5 py-4 text-kid-ink shadow-raised-4",
  FOCUS_RING,
);

// The Ja tab, /play/me (Figma 27:61076, screen 1 of #174): the child's buddy
// in the big gold ring, their name and title, four count tiles, Switch player
// when the account has another child (#184), and the way to the grown-ups
// area, through its gate (#177), which opens over this screen. A centred
// column from tablet width, the full width less a 16px gutter on a phone,
// scrolling on its own above the bottom nav, which is docked or floating as on
// the map. `data-map-screen` tells LearnerShell to drop its own Back and Home
// bar, as on the Prizes screen.
export function MeScreen({
  explorer,
  counts,
  needsRetry,
  canSwitchPlayer,
}: MeData) {
  return (
    <div
      data-map-screen
      className={cn(
        fredoka.className,
        "fixed inset-0 flex flex-col bg-kid-cream",
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-tab flex-col gap-6 px-4 pb-8 pt-safe-t sm:px-gutter">
          <header className="flex flex-col items-center gap-1 pt-6 text-center">
            {/* 122 + 2 × 8 + 2 × 3 = 144px, the skeleton's size-36. */}
            <div className="mb-3 rounded-full border-3 border-kid-ink bg-kid-yellow p-2 shadow-raised-6">
              <Image
                src={avatarSrc(explorer.avatar)}
                alt=""
                aria-hidden="true"
                width={122}
                height={122}
                // Local SVGs need no resizing (see ChromeIcon).
                unoptimized
                className="block"
              />
            </div>
            <h1 className="break-words text-4xl font-bold leading-tight text-kid-ink">
              {explorer.name}
            </h1>
            {explorer.title !== null ? (
              <p className="text-lg font-medium text-kid-muted">
                {explorer.title}
              </p>
            ) : null}
          </header>
          {needsRetry ? (
            <ProgressErrorNotice message="Your page didn’t load fully. Something went wrong on our side. Let’s try again." />
          ) : null}
          {/* Unknown counts (progress failed) show a dash, never a wrong 0. */}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CountTile tile={STARS} value={counts?.stars ?? null} />
            <CountTile tile={HEARTS} value={counts?.hearts ?? null} />
            <CountTile tile={WORDS} value={counts?.wordsLearned ?? null} />
            <CountTile tile={STICKERS} value={counts?.stickers ?? null} />
          </ul>
          {/* Only with someone to switch to; no grown-ups gate, as in Figma. */}
          {canSwitchPlayer ? (
            <Link href={PLAYERS_PATH} className={ROW_CLASS}>
              <MeRowContent
                icon="switch"
                chipClass="border-kid-ink bg-kid-sea-soft"
                label="Promijeni igrača"
              />
            </Link>
          ) : null}
          <GrownUpsGateButton
            href={GROWN_UPS_PATH}
            className={cn(ROW_CLASS, "text-left")}
          >
            <MeRowContent
              icon="lock"
              chipClass="border-kid-line bg-kid-fog"
              label="Za roditelje"
            />
          </GrownUpsGateButton>
        </div>
      </div>
      <div className="flex flex-col lg:items-center lg:pb-5">
        <MapBottomNav current="me" />
      </div>
    </div>
  );
}

type MeRowContentProps = {
  icon: ChromeIconName;
  /** The icon chip's edge and fill, written out. */
  chipClass: string;
  label: string;
};

// A row's inside: the icon on its round chip, the label and a chevron.
function MeRowContent({ icon, chipClass, label }: MeRowContentProps) {
  return (
    <>
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full border-2",
          chipClass,
        )}
      >
        <ChromeIcon name={icon} size={26} />
      </span>
      <span className="flex-1 text-2xl font-semibold leading-tight">
        {label}
      </span>
      {/* The kit's icons are drawn with a 2.5 stroke at 24px. */}
      <ChevronRightIcon
        aria-hidden="true"
        strokeWidth={2.5}
        className="size-7 shrink-0"
      />
    </>
  );
}

// A tinted tile with the ink edge: the icon on its chip, the count, and what
// it counts. One name for screen readers, "Riječi: 40", like `Counter`.
function CountTile({ tile, value }: { tile: Tile; value: number | null }) {
  return (
    <li className="flex min-w-0">
      <div
        role="group"
        aria-label={`${tile.label}: ${value ?? "nije učitano"}`}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-kid-xl border-3 border-kid-ink px-2 pb-3 pt-4 text-center shadow-raised-4",
          tile.tileClass,
        )}
      >
        <span
          className={cn(
            "mb-1 flex size-12 items-center justify-center rounded-full border-3 border-kid-ink",
            tile.chipClass,
          )}
        >
          <ChromeIcon name={tile.icon} size={26} />
        </span>
        <span
          aria-hidden="true"
          className="text-3xl font-bold leading-tight text-kid-ink"
        >
          {value ?? "–"}
        </span>
        <span
          aria-hidden="true"
          className="max-w-full truncate text-sm font-semibold text-kid-muted sm:text-base"
        >
          {tile.caption}
        </span>
      </div>
    </li>
  );
}
