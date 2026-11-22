import { useId } from "react";

import { chapterPath, regionPath } from "../model/paths";
import type { LocationScreenData } from "../model/screens";
import { ChapterCard } from "./ChapterCard";
import { ScreenHeader } from "./ScreenHeader";

// A place, /play/<region>/<location>: towns and natural places look the same.
// A section named by its heading, the region it is in (a link back to it, from
// the location's own region id), then a card per chapter in recording order
// (toLocationDetail() sorts them), each opening the chapter's screen, which
// has its lesson, games and words. Only an open place gets here: the page's
// gate, assertLocationOpen(), sends every other one away first.
// LocationScreenSkeleton mirrors it.
export function LocationScreen({ region, location }: LocationScreenData) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-6">
      <ScreenHeader
        titleId={titleId}
        title={location.name}
        parent={{ name: region.name, href: regionPath(location.regionId) }}
      />
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a <ul> whose list-style is none (Tailwind's preflight), so the role is restated */}
      <ul
        role="list"
        aria-label="Chapters"
        className="grid gap-5 sm:grid-cols-2"
      >
        {location.chapters.map((chapter) => (
          <li key={chapter.id} className="flex min-w-0">
            <ChapterCard
              chapter={chapter}
              href={chapterPath(location.regionId, location.id, chapter.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
