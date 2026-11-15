import type { ReactNode } from "react";

type SkeletonCardProps = {
  /** The text area under the picture, shaped like the card's own. */
  children: ReactNode;
};

// A word card's box while it loads: the same edge, radius and inset picture
// in the picture's aspect ratio, then the card's own text area, so the block
// is the card's size. It grows to its grid item's height, like the card.
export function SkeletonCard({ children }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      className="flex flex-1 animate-pulse flex-col overflow-hidden rounded-kid-lg border-3 border-kid-line bg-white shadow-raised-line-4"
    >
      <div className="m-2 mb-0 aspect-tile rounded-kid bg-surface-sunken" />
      {children}
    </div>
  );
}
