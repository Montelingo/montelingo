import Link from "next/link";

import { cn } from "@/lib/cn";

import { CONTENT_LANG } from "../model/content";
import type { MapRegion } from "../model/map-view";
import { ChromeIcon } from "./ChromeIcon";
import { ICON_BUTTON_CLASS } from "./chrome-styles";

const PILL_CLASS =
  "rounded-badge border-3 border-kid-ink bg-white shadow-raised-4";

type MapTopBarProps = {
  /** Where Back goes: out of the area from the map, the map from a region. */
  backHref: string;
  /** The region the progress pill shows, if any is open. */
  region: MapRegion | null;
  /** Stars and hearts: not earned yet in this phase, so always 0 for now. */
  stars: number;
  hearts: number;
};

// The map's top bar (Figma "Top bar"): Back, the region's progress, the star
// and heart counters, and on the right the sound button.
export function MapTopBar({ backHref, region, stars, hearts }: MapTopBarProps) {
  return (
    <div className="pointer-events-none relative z-20 col-span-full flex items-start justify-between gap-3 pl-safe-l pr-safe-r pt-safe-t">
      <div className="pointer-events-auto flex flex-wrap items-center gap-3.5">
        <Link href={backHref} aria-label="Nazad" className={ICON_BUTTON_CLASS}>
          <ChromeIcon name="back" size={28} />
        </Link>
        {region !== null ? <RegionPill region={region} /> : null}
        <Counter icon="star" label="Zvjezdice" value={stars} />
        <Counter icon="heart" label="Srca" value={hearts} />
      </div>
      {/* Sound comes with audio; until then the button is only drawn. */}
      <button
        type="button"
        aria-label="Zvuk"
        className={cn("pointer-events-auto", ICON_BUTTON_CLASS)}
      >
        <ChromeIcon name="sound" size={28} />
      </button>
    </div>
  );
}

// The region's name, its completed/total places, and a bar of the same.
function RegionPill({ region }: { region: MapRegion }) {
  const total = Math.max(region.placeCount, 1);
  const percent = Math.round((region.completedCount / total) * 100);
  return (
    <div
      role="group"
      aria-label={`${region.name}: ${region.completedCount} od ${region.placeCount} mjesta`}
      className="flex min-w-44 max-w-xs flex-col gap-1.5 rounded-kid-md border-3 border-kid-ink bg-white px-4 pb-2.5 pt-2 shadow-raised-4"
    >
      <div
        aria-hidden="true"
        className="flex items-start justify-between gap-2 font-semibold leading-tight"
      >
        <span lang={CONTENT_LANG} className="truncate text-kid-ink">
          {region.name}
        </span>
        <span className="text-kid-muted">
          {region.completedCount}/{region.placeCount}
        </span>
      </div>
      <div
        aria-hidden="true"
        className="h-2.5 overflow-hidden rounded-badge border-2 border-kid-ink bg-kid-fog"
      >
        {/* Inline style: the width is the region's progress, at run time. */}
        <div className="h-full bg-kid-green" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

type CounterProps = {
  icon: "star" | "heart";
  label: string;
  value: number;
};

function Counter({ icon, label, value }: CounterProps) {
  return (
    <div
      role="group"
      aria-label={`${label}: ${value}`}
      className={cn("flex items-center gap-1.5 py-1.5 pl-2 pr-3.5", PILL_CLASS)}
    >
      <ChromeIcon name={icon} size={26} />
      <span
        aria-hidden="true"
        className="text-2xl font-semibold leading-tight text-kid-ink"
      >
        {value}
      </span>
    </div>
  );
}
