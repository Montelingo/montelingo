import { LearnerPageSkeleton } from "@/features/learner";

// The neutral skeleton, so the Ja screen's own does not flash on the way in.
// The grown-ups area's skeleton comes with its cards (#178).
export default function GrownUpsLoading() {
  return <LearnerPageSkeleton />;
}
