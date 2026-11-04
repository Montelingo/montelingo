import { CARD_GRID_CLASS } from "@/components/ui/CardGrid";
import { cn } from "@/lib/cn";

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
    <div aria-busy="true" className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Loading…
      </span>
      <div aria-hidden="true" className="flex animate-pulse flex-col gap-1">
        <TextLine className="w-48 text-3xl" />
        <TextLine className="w-64 text-lg" />
      </div>
      <div aria-hidden="true" className={CARD_GRID_CLASS}>
        {Array.from({ length: cardCount }, (_, index) => (
          // Like CardGrid's list item.
          <div key={index} className="flex min-w-0">
            <CardBlock />
          </div>
        ))}
      </div>
    </div>
  );
}

// TileCard's box (CardFace): the same edge, the picture's aspect ratio, and
// the text area's padding and gap around one line of title and the badge.
function CardBlock() {
  return (
    <div className="flex flex-1 animate-pulse flex-col overflow-hidden rounded-tile border-2 border-surface-sunken bg-surface">
      <div className="aspect-tile w-full bg-surface-sunken" />
      <div className="flex flex-1 flex-col items-start gap-2 p-3">
        <TextLine className="w-3/4 text-lg leading-snug" />
        {/* The badge: a size-5 icon beside text-sm text (both 1.25rem),
            inside py-1, is 1.75rem tall. */}
        <div className="h-7 w-24 rounded-badge bg-surface-sunken" />
      </div>
    </div>
  );
}

type TextLineProps = {
  /** The width, and the font size and leading of the text it stands in for. */
  className: string;
};

// A bar exactly one line of that text tall: it holds a no-break space set in
// the same size and leading, so it follows the text if either changes.
function TextLine({ className }: TextLineProps) {
  return (
    <div className={cn("max-w-full rounded-md bg-surface-sunken", className)}>
      &nbsp;
    </div>
  );
}
