import type { ReactNode } from "react";

type SkeletonCardProps = {
  /** The text area under the picture, shaped like the card's own. */
  children: ReactNode;
};

// A picture card's box while it loads, such as a TileCard's: the same edge
// and the picture's aspect ratio, then the card's own text area, so the block
// is the card's size. It grows to its grid item's height, like the card.
export function SkeletonCard({ children }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-1 animate-pulse flex-col overflow-hidden rounded-tile border-2 border-surface-sunken bg-surface"
    >
      <div className="aspect-tile w-full bg-surface-sunken" />
      {children}
    </div>
  );
}
