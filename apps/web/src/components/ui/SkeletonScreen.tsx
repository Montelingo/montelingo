import type { ReactNode } from "react";

type SkeletonScreenProps = {
  /** The blocks standing in for the screen, each hidden from screen readers. */
  children: ReactNode;
};

// The frame of a screen's skeleton: marked busy, it says "Loading…" once to
// screen readers, then lays its blocks out in the learner screens' column.
// The blocks are plain and hidden, so there is nothing to focus or read while
// the page loads.
export function SkeletonScreen({ children }: SkeletonScreenProps) {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span role="status" className="sr-only">
        Loading…
      </span>
      {children}
    </div>
  );
}
