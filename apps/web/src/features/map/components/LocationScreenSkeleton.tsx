import { CardGridSkeleton } from "@/components/ui/CardGrid";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { SkeletonScreen } from "@/components/ui/SkeletonScreen";
import { SkeletonTextLine } from "@/components/ui/SkeletonTextLine";

// A chapter has 10 words.
const WORD_COUNT = 10;
// A chapter's lesson and its two games (ADR 0006).
const CHAPTER_PILL_COUNT = 3;

/**
 * Stands in for LocationScreen while a place loads: the heading and the line
 * naming its region, the games area, then one word group, its title and 10
 * blocks the size of a WordCard in the same grid, so nothing moves when the
 * page arrives. Plain blocks, so there is nothing to focus while it loads.
 */
export function LocationScreenSkeleton() {
  return (
    <SkeletonScreen>
      <div className="flex animate-pulse flex-col">
        <SkeletonTextLine className="w-48 text-3xl" />
        {/* The region link's line, as tall as a touch target. */}
        <div className="flex min-h-touch items-center">
          <SkeletonTextLine className="w-56 text-lg" />
        </div>
      </div>
      {/* GamesArea: its heading, then one chapter's row: its title and its
          three pills (the lesson and two games). Its box and the pills are
          not SkeletonTextLines, so it hides itself. */}
      <div
        aria-hidden="true"
        className="flex animate-pulse flex-col gap-3 rounded-tile bg-surface-muted p-4"
      >
        <SkeletonTextLine className="w-24 text-xl" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <SkeletonTextLine className="w-32 text-lg" />
          {Array.from({ length: CHAPTER_PILL_COUNT }, (_, index) => (
            <div
              key={index}
              className="h-8 w-44 rounded-badge bg-surface-sunken"
            />
          ))}
        </div>
      </div>
      {/* WordGroup: the chapter's title, then its words. */}
      <div className="flex flex-col gap-3">
        <SkeletonTextLine className="w-40 animate-pulse text-2xl" />
        <CardGridSkeleton columns="words" count={WORD_COUNT}>
          <WordBlock />
        </CardGridSkeleton>
      </div>
    </SkeletonScreen>
  );
}

// WordCard's box, with the caption's padding around one line of the word.
function WordBlock() {
  return (
    <SkeletonCard>
      <div className="px-3 pb-3 pt-2">
        <SkeletonTextLine className="mx-auto w-3/4 text-xl leading-snug" />
      </div>
    </SkeletonCard>
  );
}
