"use client";

import { XMarkIcon } from "@heroicons/react/24/solid";
import Image from "next/image";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { FOCUS_RING, ICON_BUTTON } from "@/components/ui/kid-styles";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";
import type { Random } from "@/lib/random";

import { useHold } from "../hooks/use-hold";
import { drawPuzzle, isTarget, numberWord } from "../model/gate";

// Matches the `wiggle` animation in tailwind.config.ts: a wrong digit shakes
// the digits this long, then a new puzzle comes.
const SHAKE_MS = 400;

const HOLDING_TEXT = "Držiš… samo nastavi";

export type GateDialogProps = {
  /** Called once the target was held to the end and the dialog closed. */
  onPass: () => void;
  /** Called when the grown-up closes the dialog: Escape or the close button. */
  onCancel: () => void;
  /** The puzzle's random source, injected so a test's puzzles repeat. */
  random?: Random;
};

// The grown-ups gate (#177, screen 2 of #174): "Pritisni i drži broj devet"
// over four digits, and holding the right one for HOLD_MS fills its ring and
// passes. A wrong digit shakes the digits (not with reduced motion) and draws
// a new puzzle; there is no counter and no lockout. A new puzzle is drawn
// each time the dialog mounts. A native modal <dialog>, like the level card:
// it takes the focus and keeps it, and Escape closes it.
export function GateDialog({
  onPass,
  onCancel,
  random = Math.random,
}: GateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hasPassedRef = useRef(false);
  const titleId = useId();
  const [puzzle, setPuzzle] = useState(() => drawPuzzle(random));
  const [isShaking, setIsShaking] = useState(false);
  const [hasRetried, setHasRetried] = useState(false);
  const hold = useHold(() => {
    hasPassedRef.current = true;
    dialogRef.current?.close();
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  useEffect(() => {
    if (!isShaking) {
      return;
    }
    const timer = window.setTimeout(() => {
      setPuzzle(drawPuzzle(random));
      setIsShaking(false);
      setHasRetried(true);
    }, SHAKE_MS);
    return () => window.clearTimeout(timer);
  }, [isShaking, random]);

  function press(digit: number) {
    if (isShaking || hold.heldDigit !== null) {
      return;
    }
    if (isTarget(puzzle, digit)) {
      hold.start(digit);
    } else {
      setIsShaking(true);
    }
  }

  // Only the held digit lets go: the blur of the digit the focus leaves, as
  // another is pressed, must not stop the new hold.
  function letGo(digit: number) {
    if (hold.heldDigit === digit) {
      hold.stop();
    }
  }

  // Space and Enter hold a digit as a finger does; a held key's repeats are
  // ignored, and preventing the default stops the button's click.
  function handleKeyDown(event: KeyboardEvent, digit: number) {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (!event.repeat) {
        press(digit);
      }
    }
  }

  function handleKeyUp(event: KeyboardEvent, digit: number) {
    if (event.key === " " || event.key === "Enter") {
      letGo(digit);
    }
  }

  const word = numberWord(puzzle.target);
  let status = "";
  if (hold.heldDigit !== null) {
    status = HOLDING_TEXT;
  } else if (hasRetried && !isShaking) {
    status = `Pokušaj ponovo. Pritisni i drži broj ${word}.`;
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => (hasPassedRef.current ? onPass() : onCancel())}
      className={cn(
        fredoka.className,
        "m-auto w-full max-w-md bg-transparent p-4 backdrop:bg-kid-ink/40",
      )}
    >
      <div className="flex flex-col items-center gap-4 rounded-kid-xl border-3 border-kid-ink bg-kid-cream px-6 pb-6 pt-5 text-center shadow-raised-6">
        <div className="flex w-full items-center justify-between gap-3">
          <p className="inline-flex items-center gap-1.5 rounded-badge border-2 border-kid-line bg-white px-3 py-1 text-sm font-semibold uppercase text-kid-muted">
            <Image
              src="/learner/icon-lock.svg"
              alt=""
              aria-hidden="true"
              width={18}
              height={18}
              // Local SVGs need no resizing (see the map's ChromeIcon).
              unoptimized
            />
            Samo za roditelje
          </p>
          <button
            type="button"
            aria-label="Zatvori"
            onClick={() => dialogRef.current?.close()}
            className={ICON_BUTTON}
          >
            <XMarkIcon aria-hidden="true" className="size-8 text-kid-ink" />
          </button>
        </div>
        <h2
          id={titleId}
          className="text-3xl font-semibold leading-tight text-kid-ink"
        >
          Pritisni i drži broj{" "}
          <strong className="font-bold underline decoration-kid-coral decoration-4 underline-offset-4">
            {word}
          </strong>
        </h2>
        <p className="text-base font-medium text-kid-muted">
          Brojevi napisani slovima čuvaju podešavanja od malih ruku.
        </p>
        <div
          className={cn(
            "grid w-full grid-cols-4 gap-2 py-2 sm:gap-3",
            isShaking ? "motion-safe:animate-wiggle" : undefined,
          )}
        >
          {puzzle.digits.map((digit, index) => (
            <button
              // By position, so the focus stays put when a new puzzle comes.
              key={index}
              type="button"
              onPointerDown={() => press(digit)}
              onPointerUp={() => letGo(digit)}
              onPointerLeave={() => letGo(digit)}
              onPointerCancel={() => letGo(digit)}
              onKeyDown={(event) => handleKeyDown(event, digit)}
              onKeyUp={(event) => handleKeyUp(event, digit)}
              onBlur={() => letGo(digit)}
              // A long press would open the touch menu or select the digit.
              onContextMenu={(event) => event.preventDefault()}
              className={cn(
                "relative aspect-square w-full touch-none select-none rounded-full p-1.5",
                FOCUS_RING,
              )}
            >
              <HoldRing
                progress={hold.heldDigit === digit ? hold.progress : 0}
              />
              <span
                className={cn(
                  "flex size-full items-center justify-center rounded-full border-3 border-kid-ink bg-white text-4xl font-semibold text-kid-ink",
                  hold.heldDigit === digit
                    ? "translate-y-1 shadow-none"
                    : "shadow-raised-4",
                )}
              >
                {digit}
              </span>
            </button>
          ))}
        </div>
        <p
          role="status"
          aria-live="polite"
          className="min-h-7 text-lg font-semibold text-kid-ink"
        >
          {status}
        </p>
      </div>
    </dialog>
  );
}

// The ring around a digit, filled clockwise from the top as it is held.
function HoldRing({ progress }: { progress: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 size-full -rotate-90"
    >
      <circle
        cx="50"
        cy="50"
        r="47"
        fill="none"
        strokeWidth="6"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={1 - progress}
        className={cn(
          "stroke-kid-green",
          progress === 0 ? "opacity-0" : undefined,
        )}
      />
    </svg>
  );
}
