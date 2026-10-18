import { type ReactNode } from "react";

import { BackControl } from "./BackControl";
import { HomeControl } from "./HomeControl";

type LearnerShellProps = {
  /** The top of the learner area (the map), where Home goes. */
  homeHref: string;
  /** Where Back leads from the top of the area, out of it. */
  exitHref: string;
  children: ReactNode;
};

// The learner area's full-screen frame: no site header, a bar with large Back
// and Home controls, and the page below it. Padding keeps everything inside
// the safe area (notches, rounded corners, the home indicator), and the page
// scrolls vertically only.
export function LearnerShell({
  homeHref,
  exitHref,
  children,
}: LearnerShellProps) {
  return (
    <div className="flex flex-1 flex-col gap-4 pb-safe-b pl-safe-l pr-safe-r pt-safe-t">
      <nav aria-label="Learner" className="flex items-center justify-between">
        <BackControl homeHref={homeHref} exitHref={exitHref} />
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
