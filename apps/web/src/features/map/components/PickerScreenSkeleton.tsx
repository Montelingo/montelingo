import { CardGridSkeleton } from "@/components/ui/CardGrid";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { SkeletonScreen } from "@/components/ui/SkeletonScreen";
import { SkeletonTextLine } from "@/components/ui/SkeletonTextLine";

type PickerScreenSkeletonProps = {
  /** How many card blocks stand in for the cards. */
  cardCount: number;
};

// Mirrors PickerScreen, the frame of MapHome and RegionScreen: the heading and
// its line, then the cards in CardGrid's grid, each block the size of a
// TileCard, so nothing moves when the page arrives. Plain blocks, not cards,
// so there is nothing to focus while the page loads.
export function PickerScreenSkeleton({ cardCount }: PickerScreenSkeletonProps) {
  return (
    <SkeletonScreen>
      <div className="flex animate-pulse flex-col gap-1">
        <SkeletonTextLine className="w-48 text-3xl" />
        <SkeletonTextLine className="w-64 text-lg" />
      </div>
      <CardGridSkeleton count={cardCount}>
        <CardBlock />
      </CardGridSkeleton>
    </SkeletonScreen>
  );
}

// TileCard's box (CardFace), with its text area's padding and gap around one
// line of title and the badge.
function CardBlock() {
  return (
    <SkeletonCard>
      <div className="flex flex-1 flex-col items-start gap-2 p-3">
        <SkeletonTextLine className="w-3/4 text-lg leading-snug" />
        {/* The badge: a size-5 icon beside text-sm text (both 1.25rem),
            inside py-1, is 1.75rem tall. */}
        <div className="h-7 w-24 rounded-badge bg-surface-sunken" />
      </div>
    </SkeletonCard>
  );
}
