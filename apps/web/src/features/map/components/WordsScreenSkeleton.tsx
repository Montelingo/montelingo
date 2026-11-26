import { SkeletonScreen } from "@/components/ui/SkeletonScreen";

// Stands in for WordsScreen while /play/words loads: the cream page, with
// blocks where the heading and badge, one place's name and its row of word
// cards, and the bottom nav will be. `data-map-screen` drops LearnerShell's
// Back and Home bar here too, as on the screen itself.
export function WordsScreenSkeleton() {
  return (
    <div data-map-screen>
      <SkeletonScreen>
        <div
          aria-hidden="true"
          className="fixed inset-0 animate-pulse bg-kid-cream"
        >
          <div className="mx-auto flex w-full max-w-tab flex-col gap-6 px-4 pt-safe-t sm:px-gutter">
            <div className="flex items-center justify-between pt-6">
              <div className="h-10 w-48 rounded-kid-sm bg-kid-line" />
              <div className="h-11 w-20 rounded-badge bg-white" />
            </div>
            <div className="h-8 w-36 rounded-kid-sm bg-kid-line/60" />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-3">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-28 rounded-kid bg-white" />
              ))}
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-24 rounded-t-kid-lg bg-white lg:inset-x-auto lg:bottom-5 lg:left-1/2 lg:w-bottom-nav lg:-translate-x-1/2 lg:rounded-kid-lg" />
        </div>
      </SkeletonScreen>
    </div>
  );
}
