import { useId } from "react";

import { PlaceholderArt } from "@/components/ui/PlaceholderArt";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import { CONTENT_LANG } from "../model/content";
import {
  hiddenStickersText,
  type PrizeRegion,
  type PrizesData,
  type Sticker,
} from "../model/prizes";
import { ChromeIcon } from "./ChromeIcon";
import { Counter } from "./Counter";
import { MapBottomNav } from "./MapBottomNav";
import { ProgressErrorNotice } from "./ProgressErrorNotice";

// The Prizes tab, /play/prizes (Figma "My prizes"): the title and the star
// counter, then each region in content order, an open one with a sticker per
// place and a locked one as a muted card. A centred column from tablet width,
// the full width less a 16px gutter on a phone. The column scrolls on its
// own, above the bottom nav, which is docked or floating as on the map. `data-map-screen` tells LearnerShell
// to drop its own Back and Home bar, which the nav's Map tab replaces here.
export function PrizesScreen({
  regions,
  needsProgressRetry,
  stars,
}: PrizesData) {
  return (
    <div
      data-map-screen
      className={cn(
        fredoka.className,
        "fixed inset-0 flex flex-col bg-kid-cream",
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-tab flex-col gap-4 px-4 pb-8 pt-safe-t sm:px-gutter">
          <header className="flex items-center justify-between gap-3 pt-4">
            <h1 className="text-4xl font-bold leading-tight text-kid-ink">
              Moje nagrade
            </h1>
            <Counter icon="star" label="Zvjezdice" value={stars} />
          </header>
          {needsProgressRetry ? <ProgressErrorNotice /> : null}
          {regions.map((region) =>
            region.kind === "open" ? (
              <OpenRegion key={region.id} region={region} />
            ) : (
              <LockedRegion key={region.id} region={region} />
            ),
          )}
        </div>
      </div>
      <div className="flex flex-col lg:items-center lg:pb-5">
        <MapBottomNav current="prizes" />
      </div>
    </div>
  );
}

// A white card with the raised ink edge: the name, stars out of the most it
// can give (a dash when progress failed, never a wrong 0), and a sticker per
// place, at most 10 to a line.
function OpenRegion({
  region,
}: {
  region: Extract<PrizeRegion, { kind: "open" }>;
}) {
  const stars = region.stars ?? "–";
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-kid-xl border-3 border-kid-ink bg-white px-5 pb-4 pt-4 shadow-raised-6"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id={titleId}
          lang={CONTENT_LANG}
          className="text-2xl font-semibold leading-tight text-kid-ink"
        >
          {region.name}
        </h2>
        <div
          role="group"
          aria-label={
            region.stars === null
              ? "Zvjezdice: nije učitano"
              : `Zvjezdice: ${region.stars} od ${region.maxStars}`
          }
          className="flex shrink-0 items-center gap-1 font-semibold text-kid-ink"
        >
          <ChromeIcon name="star" size={20} />
          <span aria-hidden="true">
            {stars} / {region.maxStars}
          </span>
        </div>
      </div>
      <ul className="grid grid-cols-row-of-10 gap-x-2 gap-y-3 [--row-gap:theme(spacing.2)] [--row-min:6rem]">
        {region.stickers.map((sticker) => (
          <StickerItem key={sticker.id} sticker={sticker} />
        ))}
      </ul>
    </section>
  );
}

// A round sticker and the place's name. Earned, its art is in colour; not
// yet, faded, with the lock on it. The state is spoken after the name.
function StickerItem({ sticker }: { sticker: Sticker }) {
  return (
    <li
      data-earned={sticker.isEarned}
      className="flex w-24 flex-col items-center gap-1.5 justify-self-center text-center"
    >
      <div className="relative size-20">
        <div
          className={cn(
            "size-full overflow-hidden rounded-full border-4 border-white bg-kid-fog shadow-md",
            !sticker.isEarned && "opacity-40",
          )}
        >
          {sticker.artUrl !== null ? (
            // A plain img: the designers' SVG exports need no resizing.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sticker.artUrl}
              alt=""
              aria-hidden="true"
              className="size-full object-cover"
            />
          ) : (
            <PlaceholderArt id={sticker.id} withInitial={false} />
          )}
        </div>
        {!sticker.isEarned ? (
          <ChromeIcon
            name="lock"
            size={28}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          />
        ) : null}
      </div>
      <span
        lang={CONTENT_LANG}
        className="text-sm font-semibold leading-tight text-kid-ink"
      >
        {sticker.name}
      </span>
      <span className="sr-only">
        {sticker.isEarned ? ", osvojena" : ", još nije osvojena"}
      </span>
    </li>
  );
}

// A muted card (kid-fog, as in Figma: kid-muted text is AA on it, not on
// surface-muted): the lock, the name, and how many stickers it hides. No
// stickers, so nothing gives away what the region holds.
function LockedRegion({
  region,
}: {
  region: Extract<PrizeRegion, { kind: "locked" }>;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex items-center gap-4 rounded-kid-xl border-2 border-kid-line bg-kid-fog px-5 py-4"
    >
      <ChromeIcon name="lock" size={28} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2
          id={titleId}
          className="text-2xl font-semibold leading-tight text-kid-muted"
        >
          <span lang={CONTENT_LANG}>{region.name}</span>
          <span className="sr-only"> (zaključano)</span>
        </h2>
        <p className="text-sm font-medium text-kid-muted">
          {hiddenStickersText(region.stickerCount)}
        </p>
      </div>
    </section>
  );
}
