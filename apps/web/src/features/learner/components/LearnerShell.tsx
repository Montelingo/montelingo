import { type ReactNode } from "react";

import { BackControl } from "./BackControl";
import { HomeControl } from "./HomeControl";

type LearnerShellProps = {
  /** The top of the learner area (the map), where Home goes. */
  homeHref: string;
  /** Where Back leads from the top of the area, out of it. */
  exitHref: string;
  /** Depths below `homeHref` whose URLs have no screen, which Back skips. */
  screenlessDepths?: readonly number[];
  children: ReactNode;
};

// The learner area's full-screen frame: no site header, a bar with large Back
// and Home controls, and the page below it. Padding keeps everything inside
// the safe area (notches, rounded corners, the home indicator), and the page
// scrolls vertically only.
export function LearnerShell({
  homeHref,
  exitHref,
  screenlessDepths,
  children,
}: LearnerShellProps) {
  return (
    // A map screen or the Prizes screen (data-map-screen) brings its own top
    // bar and bottom nav, and a full-screen page (data-full-screen, the
    // profile setup) its own Back, so this Back and Home bar is dropped there
    // (display: none, so it is gone for screen readers and the keyboard too).
    <div className="flex flex-1 flex-col gap-4 pb-safe-b pl-safe-l pr-safe-r pt-safe-t [&:has([data-full-screen])>nav]:hidden [&:has([data-map-screen])>nav]:hidden">
      {/* Above the page, so a full-screen map can lie under it. */}
      <nav
        aria-label="Learner"
        className="relative z-10 flex items-center justify-between"
      >
        <BackControl
          homeHref={homeHref}
          exitHref={exitHref}
          screenlessDepths={screenlessDepths}
        />
        <HomeControl homeHref={homeHref} />
      </nav>
      <main id="main-content" className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-learner flex-1 flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
