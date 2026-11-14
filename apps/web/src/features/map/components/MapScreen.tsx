import { type ReactNode, useId } from "react";

import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import { currentRegion, type MapData } from "../model/map-view";
import type { MapNotice } from "../model/notices";
import { LevelCard } from "./LevelCard";
import { MapBottomNav } from "./MapBottomNav";
import { MapSidePanel } from "./MapSidePanel";
import { MapTopBar } from "./MapTopBar";
import { NextStopCard } from "./NextStopCard";
import { ProgressErrorNotice } from "./ProgressErrorNotice";
import { UrlNotice } from "./UrlNotice";

type MapScreenProps = MapData & {
  /** Named for screen readers; the map shows its own title. */
  title: string;
  /** The zoomed region, or `null` on the whole map. */
  focusRegionId: string | null;
  /** Where the top bar's Back goes. */
  backHref: string;
  /** Why the learner was sent here, from the page's `?notice=`. */
  notice: MapNotice | null;
  /** Whether a place has no state from the server yet, which offers a retry. */
  needsProgressRetry: boolean;
  /** The map. */
  children: ReactNode;
};

// The frame MapHome and RegionScreen share (Figma "TM1" and "M1"): the map
// covers the screen, with the top bar over it, the side panel on the right
// from 1024px wide, and the bottom nav (with the next stop above it, below
// 1024px). `data-map-screen` tells LearnerShell to drop its own Back and Home
// bar, which the top bar and the nav's Map tab replace here.
export function MapScreen({
  title,
  regions,
  places,
  focusRegionId,
  backHref,
  notice,
  needsProgressRetry,
  children,
}: MapScreenProps) {
  const titleId = useId();
  const region = currentRegion(regions, places, focusRegionId);
  const nextPlace = places.find(({ isNext }) => isNext) ?? null;

  return (
    <section
      data-map-screen
      aria-labelledby={titleId}
      className={cn(fredoka.className, "flex flex-col")}
    >
      <h1 id={titleId} className="sr-only">
        {title}
      </h1>
      {children}
      <MapTopBar backHref={backHref} region={region} stars={0} hearts={0} />
      {notice !== null || needsProgressRetry ? (
        <div className="fixed inset-x-0 top-24 z-20 mx-auto flex max-w-xl flex-col gap-4 px-gutter">
          {notice !== null ? <UrlNotice key={notice} notice={notice} /> : null}
          {needsProgressRetry ? <ProgressErrorNotice /> : null}
        </div>
      ) : null}
      <div className="pointer-events-none fixed right-0 top-28 z-20 hidden pr-safe-r lg:block">
        <MapSidePanel
          regions={regions}
          currentRegionId={region?.id ?? null}
          nextPlace={nextPlace}
        />
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col gap-3 lg:items-center lg:pb-5">
        {nextPlace !== null ? (
          <div className="pointer-events-auto px-4 lg:hidden">
            <NextStopCard place={nextPlace} />
          </div>
        ) : null}
        <MapBottomNav />
      </div>
      <LevelCard regions={regions} places={places} />
    </section>
  );
}
