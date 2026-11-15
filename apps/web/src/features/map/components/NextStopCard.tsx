import { cn } from "@/lib/cn";

import { CONTENT_LANG } from "../model/content";
import { levelCardHref, type MapPlace } from "../model/map-view";
import { ChromeIcon } from "./ChromeIcon";
import { LevelCardLink } from "./LevelCardLink";
import { FOCUS_RING } from "./chrome-styles";

type NextStopCardProps = {
  place: MapPlace;
  /** Layout only. */
  className?: string;
};

// "Next stop" (Figma "Next stop card"): the next place's number and name, and
// a big coral play button that opens its level card.
export function NextStopCard({ place, className }: NextStopCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3.5 rounded-kid-lg border-3 border-kid-ink bg-white py-3.5 pl-4 pr-3.5 shadow-raised-6",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-14 shrink-0 items-center justify-center rounded-full border-3 border-kid-ink bg-kid-yellow text-2xl font-semibold text-kid-ink"
      >
        {place.order}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="whitespace-nowrap text-xs font-medium uppercase text-kid-muted">
          Sljedeće mjesto
        </span>
        <span
          lang={CONTENT_LANG}
          className="truncate text-3xl font-semibold leading-tight text-kid-ink"
        >
          {place.name}
        </span>
      </div>
      <LevelCardLink
        href={levelCardHref(place)}
        aria-label={`Otvori: ${place.name}`}
        className={cn(
          "flex size-touch-xl shrink-0 items-center justify-center rounded-full border-3 border-kid-ink bg-kid-coral shadow-raised-6",
          FOCUS_RING,
        )}
      >
        <ChromeIcon name="play" size={36} />
      </LevelCardLink>
    </div>
  );
}
