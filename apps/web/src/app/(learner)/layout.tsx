import type { Viewport } from "next";

import { PLAY_PATH } from "@/features/auth";
import { LearnerShell } from "@/features/learner";

// Lets the learner area draw edge to edge on devices with a notch or rounded
// corners: env(safe-area-inset-*) is only non-zero with viewport-fit=cover,
// and LearnerShell pads its content back inside the safe area. Next.js merges
// it with its default viewport (width=device-width, initial-scale=1). Zoom is
// never limited.
export const viewport: Viewport = {
  viewportFit: "cover",
};

type LearnerLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

// The learner area's chrome only, with no data: the session is checked one
// level down, in play/layout.tsx, so that this group's error.tsx and
// loading.tsx (which sit inside this layout) cover the check.
export default function LearnerLayout({ children }: LearnerLayoutProps) {
  return (
    <LearnerShell homeHref={PLAY_PATH} exitHref="/">
      {children}
    </LearnerShell>
  );
}
