import { CardGridSkeleton } from "@/components/ui/CardGrid";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { SkeletonScreen } from "@/components/ui/SkeletonScreen";
import { SkeletonTextLine } from "@/components/ui/SkeletonTextLine";

// A chapter has 10 words.
const WORD_COUNT = 10;

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
      {/* GamesArea: its heading, then the icon beside one line of text. Its
          box and the icon's block are not SkeletonTextLines, so it hides
          itself. */}
      <div
        aria-hidden="true"
        className="flex animate-pulse flex-col gap-2 rounded-tile bg-surface-muted p-4"
      >
        <SkeletonTextLine className="w-24 text-xl" />
        <div className="flex items-center gap-3">
          <div className="size-8 shrink-0 rounded-full bg-surface-sunken" />
          <SkeletonTextLine className="w-72 text-lg" />
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
      <div className="p-3">
        <SkeletonTextLine className="w-3/4 text-lg leading-snug" />
      </div>
    </SkeletonCard>
  );
}
