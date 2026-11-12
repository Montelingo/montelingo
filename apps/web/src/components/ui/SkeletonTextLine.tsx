import { cn } from "@/lib/cn";

type SkeletonTextLineProps = {
  /** The width, and the font size and leading of the text it stands in for. */
  className: string;
};

// A skeleton bar exactly one line of that text tall: it holds a no-break space
// set in the same size and leading, so it follows the text if either changes.
// Hidden from screen readers, which hear the skeleton's "Loading…" instead.
export function SkeletonTextLine({ className }: SkeletonTextLineProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("max-w-full rounded-md bg-surface-sunken", className)}
    >
      &nbsp;
    </div>
  );
}
