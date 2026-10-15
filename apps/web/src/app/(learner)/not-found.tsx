import Link from "next/link";

import { PLAY_PATH } from "@/features/auth";

// For notFound() inside the learner area (such as a region or place that does
// not exist): stays in the learner chrome and leads back to the map. Unknown
// URLs that match no route get the root not-found page.
export default function LearnerNotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-3xl font-bold text-ink">
        We couldn’t find that page.
      </h1>
      <p className="text-lg text-ink-muted">Let’s go back to your map.</p>
      <Link
        href={PLAY_PATH}
        className="inline-flex min-h-touch-lg items-center justify-center rounded-lg bg-action px-6 text-lg font-semibold text-action-ink hover:bg-action-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Go to your map
      </Link>
    </div>
  );
}
