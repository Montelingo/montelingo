import Image from "next/image";
import Link from "next/link";

import {
  avatarSrc,
  type Explorer,
  PLACEHOLDER_EXPLORER_NAME,
} from "@/features/profile/edge";
import { cn } from "@/lib/cn";

import { CONTENT_LANG } from "../model/content";
import { isOpenState } from "../model/map-state";
import type { MapPlace, MapRegion } from "../model/map-view";
import { ChromeIcon } from "./ChromeIcon";
import { NextStopCard } from "./NextStopCard";
import { FOCUS_RING } from "./chrome-styles";

type MapSidePanelProps = {
  regions: readonly MapRegion[];
  /** The region shown on the map, marked as the current one. */
  currentRegionId: string | null;
  nextPlace: MapPlace | null;
  /** The child, or `null` before the profile is set up. */
  explorer: Explorer | null;
};

// The tablet and desktop side panel (Figma "Side panel", TM1): the explorer,
// every region with its progress or what opens it, and the next stop. Until
// the profile is set up, the explorer is the fox and a title.
export function MapSidePanel({
  regions,
  currentRegionId,
  nextPlace,
  explorer,
}: MapSidePanelProps) {
  return (
    <aside
      aria-label="Regije"
      className="pointer-events-auto flex w-[22.5rem] flex-col gap-3.5 rounded-kid-xl border-3 border-kid-ink bg-kid-cream p-5 shadow-raised-6"
    >
      <ExplorerBadge explorer={explorer} />
      <h2 className="text-2xl font-semibold leading-tight text-kid-ink">
        Regije
      </h2>
      <ul className="flex flex-col gap-3.5">
        {regions.map((region) => (
          <li key={region.id}>
            <RegionCard
              region={region}
              isCurrent={region.id === currentRegionId}
            />
          </li>
        ))}
      </ul>
      {nextPlace !== null ? <NextStopCard place={nextPlace} /> : null}
    </aside>
  );
}

function ExplorerBadge({ explorer }: { explorer: Explorer | null }) {
  if (explorer === null) {
    return (
      <div className="flex items-center gap-3">
        <ChromeIcon name="avatar" size={58} />
        <span className="text-3xl font-semibold leading-tight text-kid-ink">
          {PLACEHOLDER_EXPLORER_NAME}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Image
        src={avatarSrc(explorer.avatar)}
        alt=""
        aria-hidden="true"
        width={58}
        height={58}
        // Local SVGs need no resizing (see ChromeIcon).
        unoptimized
        className="shrink-0"
      />
      <span className="flex min-w-0 flex-col">
        <span className="break-words text-3xl font-semibold leading-tight text-kid-ink">
          {explorer.name}
        </span>
        <span className="text-sm font-medium text-kid-muted">
          {explorer.title}
        </span>
      </span>
    </div>
  );
}

type RegionCardProps = {
  region: MapRegion;
  isCurrent: boolean;
};

function RegionCard({ region, isCurrent }: RegionCardProps) {
  const isOpen = isOpenState(region.state);
  // Only the server decides what opens a region (ADR 0005), so a locked one
  // says only that it is locked.
  const detail = isOpen
    ? `${region.completedCount} od ${region.placeCount} mjesta`
    : "Još zaključano";
  const body = (
    <>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full border-[2.5px] border-kid-ink",
          isOpen ? "bg-kid-land" : "bg-white",
        )}
      >
        <ChromeIcon name={isOpen ? "region-map" : "lock"} size={22} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span
          lang={CONTENT_LANG}
          className="truncate text-2xl font-semibold leading-tight"
        >
          {region.name}
        </span>
        <span lang={CONTENT_LANG} className="text-sm font-medium">
          {detail}
        </span>
      </span>
    </>
  );
  const cardClass = cn(
    "flex w-full items-center gap-3 rounded-kid px-3.5 py-3",
    isOpen
      ? "border-3 border-kid-ink text-kid-ink"
      : "border-2 border-kid-line bg-kid-fog text-kid-muted",
    isOpen && (isCurrent ? "bg-kid-yellow-soft" : "bg-white"),
  );

  return isOpen ? (
    <Link
      href={region.href}
      aria-current={isCurrent ? "page" : undefined}
      className={cn(cardClass, FOCUS_RING)}
    >
      {body}
    </Link>
  ) : (
    <div className={cardClass}>{body}</div>
  );
}
