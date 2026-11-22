import { SkeletonScreen } from "@/components/ui/SkeletonScreen";
import { SkeletonTextLine } from "@/components/ui/SkeletonTextLine";

// A place has one to four chapters; most have one or two.
const CHAPTER_COUNT = 2;
// The pictures on a ChapterCard.
const PREVIEW_COUNT = 3;

/**
 * Stands in for LocationScreen while a place loads: the heading and the line
 * naming its region, then blocks the size of a ChapterCard in the same grid,
 * so nothing moves when the page arrives. Plain blocks, so there is nothing
 * to focus while it loads.
 */
export function LocationScreenSkeleton() {
  return (
    <SkeletonScreen>
      <div className="flex animate-pulse flex-col">
        <SkeletonTextLine className="w-48 text-4xl" />
        {/* The region link's line, as tall as a touch target. */}
        <div className="flex min-h-touch items-center">
          <SkeletonTextLine className="w-56 text-lg" />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="grid animate-pulse gap-5 sm:grid-cols-2"
      >
        {Array.from({ length: CHAPTER_COUNT }, (_, card) => (
          <div
            key={card}
            className="overflow-hidden rounded-kid-lg border-3 border-kid-line bg-white"
          >
            <div className="grid grid-cols-3 gap-2 border-b-3 border-kid-line p-3">
              {Array.from({ length: PREVIEW_COUNT }, (_, picture) => (
                <div
                  key={picture}
                  className="aspect-square rounded-kid bg-surface-sunken"
                />
              ))}
            </div>
            <div className="flex flex-col gap-2 p-4">
              <SkeletonTextLine className="w-2/3 text-2xl leading-tight" />
              <SkeletonTextLine className="w-1/3 text-lg" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonScreen>
  );
}
