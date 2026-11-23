import { SkeletonScreen } from "@/components/ui/SkeletonScreen";

// Stands in for MeScreen while /play/me loads: the cream page, with blocks
// where the buddy's ring, the name, the title, the three tiles, the grown-ups
// row and the bottom nav will be. `data-map-screen` drops LearnerShell's Back
// and Home bar here too, as on the screen itself.
export function MeScreenSkeleton() {
  return (
    <div data-map-screen>
      <SkeletonScreen>
        <div
          aria-hidden="true"
          className="fixed inset-0 animate-pulse bg-kid-cream"
        >
          <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 pt-safe-t sm:px-gutter">
            <div className="flex flex-col items-center gap-2 pt-6">
              <div className="mb-3 size-36 rounded-full bg-kid-line" />
              <div className="h-10 w-40 rounded-kid-sm bg-kid-line" />
              <div className="h-6 w-52 rounded-kid-sm bg-kid-line/60" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="h-36 rounded-kid-xl bg-white" />
              <div className="h-36 rounded-kid-xl bg-white" />
              <div className="h-36 rounded-kid-xl bg-white" />
            </div>
            <div className="h-20 rounded-kid-xl bg-white" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-24 rounded-t-kid-lg bg-white lg:inset-x-auto lg:bottom-5 lg:left-1/2 lg:w-bottom-nav lg:-translate-x-1/2 lg:rounded-kid-lg" />
        </div>
      </SkeletonScreen>
    </div>
  );
}
