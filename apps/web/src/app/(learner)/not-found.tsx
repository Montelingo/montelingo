import Link from "next/link";

import { ACTION_SIZE_STYLES, ACTION_STYLE } from "@/components/ui/action-style";
import { PLAY_PATH } from "@/features/auth";
import { cn } from "@/lib/cn";

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
        className={cn(ACTION_STYLE, ACTION_SIZE_STYLES.large)}
      >
        Go to your map
      </Link>
    </div>
  );
}
