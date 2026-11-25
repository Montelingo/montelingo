import { SkeletonScreen } from "@/components/ui/SkeletonScreen";

// Stands in for PlayersScreen while /play/me/players loads: the sky page,
// with blocks where Back, the heading and two player cards will be.
// `data-full-screen` drops LearnerShell's Back and Home bar, as on the screen.
export function PlayersScreenSkeleton() {
  return (
    <div data-full-screen>
      <SkeletonScreen>
        <div
          aria-hidden="true"
          className="fixed inset-0 animate-pulse bg-kid-sea-soft"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 pt-safe-t sm:px-gutter">
            <div className="size-touch-lg self-start rounded-full bg-white" />
            <div className="mt-6 h-12 w-52 rounded-kid-sm bg-kid-line sm:mt-16" />
            <div className="flex gap-7">
              <div className="h-48 w-36 rounded-kid-lg bg-white" />
              <div className="h-48 w-36 rounded-kid-lg bg-white" />
            </div>
          </div>
        </div>
      </SkeletonScreen>
    </div>
  );
}
