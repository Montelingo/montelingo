import { SkeletonScreen } from "@/components/ui/SkeletonScreen";

// Stands in for MapScreen while a map screen loads: the sea over the whole
// screen, with blocks where the top bar and the bottom nav will be, so
// nothing moves when the map arrives. `data-map-screen` drops LearnerShell's
// Back and Home bar here too, as on the map itself.
export function MapScreenSkeleton() {
  return (
    <div data-map-screen>
      <SkeletonScreen>
        <div
          aria-hidden="true"
          className="fixed inset-0 animate-pulse bg-kid-sea"
        >
          <div className="flex gap-3.5 pl-safe-l pt-safe-t">
            <div className="size-touch-lg rounded-full bg-white/70" />
            <div className="h-touch-lg w-44 rounded-kid-md bg-white/70" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-24 rounded-t-kid-lg bg-white/70 lg:inset-x-auto lg:bottom-5 lg:left-1/2 lg:w-[32.5rem] lg:-translate-x-1/2 lg:rounded-kid-lg" />
        </div>
      </SkeletonScreen>
    </div>
  );
}
