import { SkeletonScreen } from "@/components/ui/SkeletonScreen";

// Stands in for GrownUpsArea while /play/me/grown-ups loads: the cream page,
// with blocks where Back and the title, the progress card and the account
// card will be. `data-map-screen` drops LearnerShell's bar, as on the screen.
export function GrownUpsAreaSkeleton() {
  return (
    <div data-map-screen>
      <SkeletonScreen>
        <div
          aria-hidden="true"
          className="fixed inset-0 animate-pulse bg-kid-cream"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3.5 px-4 pt-safe-t sm:px-gutter">
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="size-touch-lg rounded-full bg-white" />
              <div className="h-8 w-40 rounded-kid-sm bg-kid-line" />
              <div className="size-touch-lg" />
            </div>
            <div className="h-60 rounded-kid-md bg-white" />
            <div className="h-24 rounded-kid-md bg-white" />
          </div>
        </div>
      </SkeletonScreen>
    </div>
  );
}
