import Image from "next/image";
import { useId } from "react";

import { cn } from "@/lib/cn";

import {
  AGE_BANDS,
  type AgeBand,
  avatarSrc,
  type Avatar,
} from "../model/profile";
import type { SetupState } from "../model/setup";
import { CHOICE, CHOICE_PICKED } from "./setup-styles";

// Each band's picture on its card, as in Figma A6.
const BAND_AVATAR: Record<AgeBand, Avatar> = {
  "3-4": "bunny",
  "5-6": "fox",
  "7": "owl",
};

type AgeStepProps = {
  state: SetupState;
  onBandPick: (ageBand: AgeBand) => void;
  headingRef: React.Ref<HTMLHeadingElement>;
};

// Figma A6 "How old is {name}?": three cards, one of which must be picked.
// The fields only; ProfileSetup's form owns Next.
export function AgeStep({ state, onBandPick, headingRef }: AgeStepProps) {
  const headingId = useId();
  const errorId = useId();
  const hasError = state.error !== null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="break-words text-4xl font-semibold text-kid-ink outline-none"
        >
          Koliko godina ima {state.name.trim()}?
        </h1>
        <p className="text-lg font-medium text-kid-muted">
          Izabraćemo riječi i igre po mjeri.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={headingId}
        aria-describedby={hasError ? errorId : undefined}
        className="flex flex-col gap-4"
      >
        {AGE_BANDS.map(({ id, label, title, detail }) => {
          const picked = state.ageBand === id;
          return (
            <label
              key={id}
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-kid-lg px-5 py-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus",
                picked ? CHOICE_PICKED : CHOICE,
              )}
            >
              <input
                type="radio"
                name="age_band"
                value={id}
                checked={picked}
                onChange={() => onBandPick(id)}
                className="sr-only"
              />
              <Image
                src={avatarSrc(BAND_AVATAR[id])}
                alt=""
                width={56}
                height={56}
                unoptimized
              />
              <span className="flex flex-col">
                <span className="text-4xl font-semibold text-kid-ink">
                  {label}
                </span>
                <span className="text-base font-medium text-kid-ink">
                  {title} · {detail}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {hasError ? (
        <p id={errorId} className="text-base font-semibold text-red-700">
          {state.error}
        </p>
      ) : null}
    </>
  );
}
