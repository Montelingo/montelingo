import { PuzzlePieceIcon } from "@heroicons/react/24/solid";
import { useId } from "react";

import {
  type Chapter,
  CONTENT_LANG,
  type LocationDetail,
} from "../model/content";

/**
 * What a place's games area is given. Phase 2 fills the area from these alone,
 * so the place's page and screen stay as they are. Plain data, so the area
 * may become a Client Component.
 */
export type GamesAreaProps = {
  /** The place the games are for. */
  location: Pick<LocationDetail, "id" | "name" | "regionId">;
  /** The place's chapters, with their words, in recording order. */
  chapters: readonly Chapter[];
};

// The one place on a place's screen where its games go, marked as a labelled
// region. In phase 1 it says the games are coming: a calm note, with nothing
// to press and nothing that looks disabled, failed, or still loading. The
// place's name in it is Montenegrin, so it carries the content's `lang`.
// `chapters` is unused until the games arrive.
export function GamesArea({ location }: GamesAreaProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-2 rounded-tile bg-surface-muted p-4"
    >
      <h2 id={titleId} className="text-xl font-bold text-ink">
        Games
      </h2>
      <div className="flex items-center gap-3">
        <PuzzlePieceIcon
          aria-hidden="true"
          className="size-8 shrink-0 text-ink"
        />
        <p className="text-lg text-ink">
          Games for <span lang={CONTENT_LANG}>{location.name}</span> are coming
          soon.
        </p>
      </div>
    </section>
  );
}
