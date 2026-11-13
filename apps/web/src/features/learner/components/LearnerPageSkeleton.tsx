import { SkeletonScreen } from "@/components/ui/SkeletonScreen";
import { SkeletonTextLine } from "@/components/ui/SkeletonTextLine";

// The learner area's neutral skeleton, for waits that come before any page's
// own loading.tsx (the session check): a heading and a body, in no one page's
// shape. Plain blocks, so there is nothing to focus while the page loads.
export function LearnerPageSkeleton() {
  return (
    <SkeletonScreen>
      {/* A heading: one line of the screens' text-3xl titles. */}
      <SkeletonTextLine className="w-48 animate-pulse text-3xl" />
      <div
        aria-hidden="true"
        className="h-32 animate-pulse rounded-lg bg-surface-sunken"
      />
    </SkeletonScreen>
  );
}
