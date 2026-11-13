import Link from "next/link";
import { useId } from "react";

import { CONTENT_LANG } from "../model/content";
import { regionPath } from "../model/paths";
import type { LocationScreenData } from "../model/screens";
import { GamesArea } from "./GamesArea";
import { WordGroup } from "./WordGroup";

// A place, /play/<region>/<location>: towns and natural places look the same.
// A section named by its heading, the region it is in (a link back to it, from
// the location's own region id), then the games area, near the top so the
// first words still show without scrolling, then its word groups in recording
// order (toLocationDetail() sorts them). The place's and the region's names
// are Montenegrin, like the words, so they carry its `lang`; the English
// around them does not. Only an open place gets here: the page's gate,
// assertLocationOpen(), sends every other one away first.
// LocationScreenSkeleton mirrors it.
export function LocationScreen({ region, location }: LocationScreenData) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-6">
      <div className="flex flex-col">
        <h1
          id={titleId}
          lang={CONTENT_LANG}
          className="text-3xl font-bold text-ink"
        >
          {location.name}
        </h1>
        <p className="flex flex-wrap items-center gap-x-1.5 text-lg text-ink-muted">
          In
          {/* As tall as a touch target, though it reads as a line of text. */}
          <Link
            href={regionPath(location.regionId)}
            lang={CONTENT_LANG}
            className="inline-flex min-h-touch items-center rounded-md font-semibold text-ink underline underline-offset-4 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {region.name}
          </Link>
        </p>
      </div>
      <GamesArea location={location} chapters={location.chapters} />
      {location.chapters.map((chapter) => (
        <WordGroup key={chapter.id} chapter={chapter} />
      ))}
    </section>
  );
}
