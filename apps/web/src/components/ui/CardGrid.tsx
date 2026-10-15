import { Children, isValidElement, type ReactNode } from "react";

import { cn } from "@/lib/cn";

type CardGridProps = {
  /** Names the list for screen readers, such as "Regions". */
  label: string;
  /** The cards. Each one becomes a list item. */
  children: ReactNode;
  /** Layout only. */
  className?: string;
};

// A labelled list of cards in as many columns as fit (the `tiles` grid token):
// three on the smallest supported tablet in portrait, four in landscape. It
// never scrolls sideways: columns shrink to the container, items may shrink
// below their content's width, and long titles wrap.
export function CardGrid({ label, children, className }: CardGridProps) {
  return (
    // eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a <ul> whose list-style is none (Tailwind's preflight), so the role is restated
    <ul
      role="list"
      aria-label={label}
      className={cn("grid grid-cols-tiles gap-4", className)}
    >
      {Children.toArray(children).map((child, index) => (
        <li
          key={isValidElement(child) && child.key !== null ? child.key : index}
          className="flex min-w-0"
        >
          {child}
        </li>
      ))}
    </ul>
  );
}
