import { Children, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

// The grid and its gap, the same for every column size so they cannot drift
// apart, then the columns per `columns`. CardGridSkeleton uses them too, so a
// skeleton's blocks fall where the cards will.
const GRID_CLASS = "grid gap-4";
const COLUMNS_CLASSES = {
  /** Picture cards with a title and a badge, such as `TileCard`. */
  tiles: "grid-cols-tiles",
  /** Smaller cards that carry one word, so more fit in a row. */
  words: "grid-cols-words",
} as const;

// Each card's item: the card fills its height, and may shrink below its
// content's width.
const ITEM_CLASS = "flex min-w-0";

type CardGridColumns = keyof typeof COLUMNS_CLASSES;

// The list's name: its own words, or a heading already on screen, so the name
// is not written twice.
type CardGridName =
  | {
      /** Names the list for screen readers, such as "Regions". */
      label: string;
      labelledBy?: never;
    }
  | {
      /** The `id` of the visible heading that names the list. */
      labelledBy: string;
      label?: never;
    };

type CardGridProps = CardGridName & {
  /** The column size: `tiles` (the default) or the smaller `words`. */
  columns?: CardGridColumns;
  /** The cards. Each one becomes a list item. */
  children: ReactNode;
  /** Layout only. */
  className?: string;
};

// A labelled list of cards in as many columns as fit (the `tiles` and `words`
// grid tokens): for tiles, three on the smallest supported tablet in portrait
// and four in landscape; for words, four and six. It never scrolls sideways:
// columns shrink to the container, items may shrink below their content's
// width, and long titles wrap.
export function CardGrid({
  label,
  labelledBy,
  columns = "tiles",
  children,
  className,
}: CardGridProps) {
  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a <ul> whose list-style is none (Tailwind's preflight), so the role is restated
    <ul
      role="list"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn(GRID_CLASS, COLUMNS_CLASSES[columns], className)}
    >
      {/* Children.toArray keys every element (from its own key, or its
          position); text has no key, so it keeps its position. */}
      {Children.toArray(children).map((child, index) => (
        <li
          key={isValidElement(child) ? child.key : index}
          className={ITEM_CLASS}
        >
          {child}
        </li>
      ))}
    </ul>
  );
}

type CardGridSkeletonProps = {
  /** The columns of the `CardGrid` it stands in for. */
  columns?: CardGridColumns;
  /** How many blocks stand in for the cards. */
  count: number;
  /** One block, the size of a card, repeated `count` times. */
  children: ReactNode;
};

// Stands in for a CardGrid while its cards load: `count` blocks in the same
// grid, each in an item like the list's, so nothing moves when the cards
// arrive. Hidden from screen readers, so not a list.
export function CardGridSkeleton({
  columns = "tiles",
  count,
  children,
}: CardGridSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(GRID_CLASS, COLUMNS_CLASSES[columns])}
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={ITEM_CLASS}>
          {children}
        </div>
      ))}
    </div>
  );
}
