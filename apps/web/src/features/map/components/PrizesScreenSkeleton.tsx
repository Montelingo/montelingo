import { SkeletonScreen } from "@/components/ui/SkeletonScreen";

// Stands in for PrizesScreen while /play/prizes loads: the cream page, with
// blocks where the title, the counter, the region cards and the bottom nav
// will be, so nothing moves when the stickers arrive. `data-map-screen` drops
// LearnerShell's Back and Home bar here too, as on the screen itself.
export function PrizesScreenSkeleton() {
  return (
    <div data-map-screen>
      <SkeletonScreen>
        <div
          aria-hidden="true"
          className="fixed inset-0 animate-pulse bg-kid-cream"
        >
          <div className="mx-auto flex w-full max-w-prizes flex-col gap-4 px-4 pt-safe-t sm:px-gutter">
            <div className="flex items-center justify-between gap-3 pt-4">
              <div className="h-10 w-56 rounded-kid-sm bg-kid-line" />
              <div className="h-12 w-20 rounded-badge bg-kid-line" />
            </div>
            <div className="h-44 rounded-kid-xl bg-white" />
            <div className="h-20 rounded-kid-xl bg-kid-line/60" />
            <div className="h-20 rounded-kid-xl bg-kid-line/60" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-24 rounded-t-kid-lg bg-white lg:inset-x-auto lg:bottom-5 lg:left-1/2 lg:w-bottom-nav lg:-translate-x-1/2 lg:rounded-kid-lg" />
        </div>
      </SkeletonScreen>
    </div>
  );
}
