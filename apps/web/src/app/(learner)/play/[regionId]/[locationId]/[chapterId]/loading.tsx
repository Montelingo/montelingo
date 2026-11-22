import { LearnerPageSkeleton } from "@/features/learner";

// A chapter, its lesson or a game loading: the learner area's neutral skeleton, not the
// place's, which would otherwise show from the level above.
export default function ChapterLoading() {
  return <LearnerPageSkeleton />;
}
