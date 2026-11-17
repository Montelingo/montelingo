import Image from "next/image";
import type { ReactNode } from "react";

import { FOCUS_RING } from "@/components/ui/focus-ring";
import { WelcomeFrame } from "@/features/learner";
import { cn } from "@/lib/cn";

type SetupFrameProps = {
  /** Which of the steps this is, from 1, for the dots. */
  step: number;
  stepCount: number;
  /** Goes to the previous step, or `null` on the first. */
  onBack: (() => void) | null;
  /** The welcome frame's picture (see WelcomeFrame). */
  art: ReactNode;
  children: ReactNode;
};

// The setup's screen (Figma A5, A6): the welcome frame, with Back, the step
// dots and the step itself in its panel. `data-full-screen` tells LearnerShell
// to drop its own Back and Home bar, which this replaces.
export function SetupFrame({
  step,
  stepCount,
  onBack,
  art,
  children,
}: SetupFrameProps) {
  return (
    <div data-full-screen>
      <WelcomeFrame art={art}>
        <div className="flex h-touch-lg items-center gap-6">
          {onBack !== null ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Nazad"
              className={cn(
                "inline-flex size-touch-lg shrink-0 items-center justify-center rounded-full border-3 border-kid-ink bg-white shadow-raised-4",
                FOCUS_RING,
              )}
            >
              <Image
                src="/learner/icon-back.svg"
                alt=""
                width={28}
                height={28}
                unoptimized
              />
            </button>
          ) : null}
          <p className="sr-only">{`Korak ${step} od ${stepCount}`}</p>
          <div aria-hidden="true" className="flex items-center gap-2">
            {Array.from({ length: stepCount }, (_, index) => (
              <span
                key={index}
                className={cn(
                  "h-2.5 rounded-full",
                  index + 1 === step ? "w-7 bg-kid-ink" : "w-2.5 bg-kid-line",
                )}
              />
            ))}
          </div>
        </div>
        {children}
      </WelcomeFrame>
    </div>
  );
}
