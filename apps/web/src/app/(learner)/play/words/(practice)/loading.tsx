import { LearnerPageSkeleton } from "@/features/learner";

// A practice game loading: the learner area's neutral skeleton, not Riječi's,
// which would otherwise show from the level above.
export default function PracticeLoading() {
  return <LearnerPageSkeleton />;
}
