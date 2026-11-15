import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { avatarSrc } from "../model/profile";
import { FOCUS_RING } from "./setup-styles";

type SetupFrameProps = {
  /** Which of the steps this is, from 1, for the dots. */
  step: number;
  stepCount: number;
  /** Goes to the previous step, or `null` on the first. */
  onBack: (() => void) | null;
  children: ReactNode;
};

// The setup's split screen (Figma A5, A6): the map's art with the Montelingo
// badge on the left, from 1024px wide, and the cream panel with Back, the step
// dots and the step itself. `data-full-screen` tells LearnerShell to drop its
// own Back and Home bar, which this replaces.
export function SetupFrame({
  step,
  stepCount,
  onBack,
  children,
}: SetupFrameProps) {
  return (
    <div
      data-full-screen
      className="fixed inset-0 grid bg-kid-cream lg:grid-cols-[1fr_minmax(0,40rem)]"
    >
      <div
        aria-hidden="true"
        className="relative hidden overflow-hidden border-r-3 border-kid-ink bg-kid-sea lg:block"
      >
        <Image
          src="/maps/base.svg"
          alt=""
          fill
          unoptimized
          className="object-cover"
        />
        <div className="absolute bottom-16 left-10 flex items-center gap-4 rounded-kid-lg border-3 border-kid-ink bg-kid-yellow px-5 py-4 shadow-raised-6">
          <Image
            src={avatarSrc("fox")}
            alt=""
            width={64}
            height={64}
            unoptimized
          />
          <span className="flex flex-col">
            <span className="text-3xl font-semibold text-kid-ink">
              Montelingo
            </span>
            <span className="text-sm font-medium text-kid-ink">
              Mali istraživači, velike riječi
            </span>
          </span>
        </div>
      </div>
      <div className="flex min-h-0 flex-col overflow-y-auto px-gutter pb-safe-b pt-safe-t">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 py-6">
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
        </div>
      </div>
    </div>
  );
}
