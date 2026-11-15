import Image from "next/image";

import { cn } from "@/lib/cn";

import { avatarSrc, type Avatar } from "../model/profile";
import { FOCUS_RING } from "./setup-styles";

/** The first place to explore, as the map decided it. */
export type FirstStop = {
  name: string;
  regionName: string;
  /** The place's number in its region. */
  order: number;
};

type ReadyScreenProps = {
  avatar: Avatar;
  firstStop: FirstStop | null;
  onStart: () => void;
  headingRef: React.Ref<HTMLHeadingElement>;
};

// After the setup (Figma "Ready to explore!"): the buddy, the first stop, and
// the way onto the map.
export function ReadyScreen({
  avatar,
  firstStop,
  onStart,
  headingRef,
}: ReadyScreenProps) {
  return (
    <div
      data-full-screen
      className="fixed inset-0 flex flex-col items-center justify-center gap-6 overflow-y-auto bg-kid-sea px-gutter pb-safe-b pt-safe-t text-center"
    >
      <span className="rounded-full bg-kid-yellow p-3 ring-4 ring-kid-ink">
        <Image
          src={avatarSrc(avatar)}
          alt=""
          width={144}
          height={144}
          unoptimized
        />
      </span>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-5xl font-semibold text-kid-ink outline-none"
      >
        Spremni za istraživanje!
      </h1>
      {firstStop !== null ? (
        <>
          <p className="text-xl font-medium text-kid-ink">
            Prva stanica: {firstStop.name}, {firstStop.regionName}.
          </p>
          <p className="flex items-center gap-3 rounded-full border-3 border-kid-ink bg-white py-2 pl-2 pr-6 text-2xl font-semibold text-kid-ink">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-full border-3 border-kid-ink bg-kid-yellow text-xl"
            >
              {firstStop.order}
            </span>
            {firstStop.name}
          </p>
        </>
      ) : null}
      <button
        type="button"
        onClick={onStart}
        className={cn(
          "mt-6 flex h-touch-xl w-full max-w-sm items-center justify-center gap-3 rounded-kid-lg border-3 border-kid-ink bg-kid-coral text-2xl font-semibold text-white shadow-raised-4",
          FOCUS_RING,
        )}
      >
        <Image
          src="/learner/icon-play.svg"
          alt=""
          width={24}
          height={24}
          unoptimized
        />
        Krenimo!
      </button>
    </div>
  );
}
