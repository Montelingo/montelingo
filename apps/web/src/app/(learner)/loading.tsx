import { LearnerPageSkeleton } from "@/features/learner";

// Shown inside the learner chrome during the session check in
// play/layout.tsx, before any page's own loading.tsx can show. Neutral, so it
// suits every page in the area.
export default function LearnerLoading() {
  return <LearnerPageSkeleton />;
}
