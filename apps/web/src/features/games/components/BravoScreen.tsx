"use client";

import Link from "next/link";
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";

import { BIG_BUTTON } from "@/components/ui/kid-styles";
import { CONTENT_LANG, PlaceStickerArt } from "@/features/map/edge";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";
import { MONTENEGRIN } from "@/lib/locale";
import { SETTLE_DELAY_MS, useSettled } from "@/lib/use-settled";

/** The sticker a game gives when it completes its place. */
export type GameReward = {
  /** The place's id: the sticker is the map's art around it. */
  placeId: string;
  /** The place's name, the sticker's name. */
  name: string;
  /** Stars the place gives. */
  stars: number;
};

export type BravoScreenProps = {
  /** What the child did: the words learned, or on a replay, plain praise. */
  message: string;
  placeHref: string;
  learnerName: string | undefined;
  reward: GameReward | null;
  /** Shown under the praise when the result did not save, with its retry. */
  saveNotice?: ReactNode;
  onPlayAgain: () => void;
};

// Figma "TM5 · Result – stars": the sea, a little confetti, three stars, the
// praise and how many words the child now knows, the place's sticker when the
// game completed the place, and at the bottom the way back and "Igraj
// ponovo". Both games end on it. The heading takes the focus, so a screen
// reader hears "Bravo!" at once. The buttons wait a moment, so a tap still
// meant for the game does not press one.
export function BravoScreen({
  message,
  placeHref,
  learnerName,
  reward,
  saveNotice,
  onPlayAgain,
}: BravoScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const settled = useSettled(SETTLE_DELAY_MS);

  return (
    <div
      lang={CONTENT_LANG}
      className={cn(
        fredoka.className,
        "flex flex-1 flex-col items-center bg-kid-sea px-4 pb-safe-b pt-12 text-kid-ink",
      )}
    >
      <div className="relative flex w-full max-w-sm flex-1 flex-col items-center justify-between gap-10">
        <Confetti />
        <div className="relative flex flex-col items-center gap-4 text-center">
          <div aria-hidden="true" className="flex items-end gap-1">
            <Star className="size-20" />
            <Star className="size-24" />
            <Star className="size-20" />
          </div>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-5xl font-bold leading-tight focus:outline-none"
          >
            {learnerName ? `Bravo, ${learnerName}!` : "Bravo!"}
          </h2>
          <p className="text-xl font-medium">{message}</p>
          {reward !== null ? <RewardCard reward={reward} /> : null}
        </div>
        {saveNotice}
        <div className="flex w-full flex-col gap-3">
          <Link
            href={placeHref}
            onClick={(event) => {
              if (!settled()) {
                event.preventDefault();
              }
            }}
            className={cn(BIG_BUTTON, "bg-kid-yellow")}
          >
            Nazad na mjesto
          </Link>
          <button
            type="button"
            onClick={() => {
              if (settled()) {
                onPlayAgain();
              }
            }}
            className={cn(BIG_BUTTON, "bg-white")}
          >
            Igraj ponovo
          </button>
        </div>
      </div>
    </div>
  );
}

// Figma "Earned": the round sticker, "Nova naljepnica", the place's name and
// the stars it gives, on a white card with the raised ink edge.
function RewardCard({ reward }: { reward: GameReward }) {
  return (
    <div className="mt-2 flex items-center gap-3.5 rounded-kid-xl border-3 border-kid-ink bg-white py-4 pl-5 pr-6 text-left shadow-raised-6">
      <div className="size-20 shrink-0 overflow-hidden rounded-full border-4 border-white bg-kid-sea shadow-md">
        <PlaceStickerArt placeId={reward.placeId} className="size-full" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium uppercase tracking-wide text-kid-muted">
          Nova naljepnica
        </span>
        <span className="text-2xl font-bold leading-tight">{reward.name}</span>
        <span className="flex items-center gap-1 font-semibold">
          <Star className="size-5" />
          {starsText(reward.stars)}
        </span>
      </div>
    </div>
  );
}

function Star({ className }: { className: string }) {
  return (
    // A plain img: the kit's star icon is a small same-origin SVG.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/learner/icon-star.svg"
      alt=""
      aria-hidden="true"
      className={className}
    />
  );
}

// Figma's confetti, placed as in its 390px column, in percentages, so the
// pieces stay inside a narrower phone's column: decoration only.
const CONFETTI: readonly { style: CSSProperties; color: string }[] = [
  {
    style: { left: "10%", top: 30, width: 17, height: 12, rotate: "-15deg" },
    color: "bg-kid-coral",
  },
  { style: { left: "23%", top: 0, width: 13, height: 8 }, color: "bg-white" },
  { style: { left: "85%", top: 20, width: 19, height: 12 }, color: "bg-white" },
  {
    style: { left: "77%", top: 210, width: 19, height: 12, rotate: "35deg" },
    color: "bg-kid-green",
  },
  {
    style: { left: "15%", top: 240, width: 20, height: 13, rotate: "30deg" },
    color: "bg-white",
  },
  {
    style: { left: "87%", top: 330, width: 16, height: 10, rotate: "-15deg" },
    color: "bg-kid-coral",
  },
];

function Confetti() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {CONFETTI.map(({ style, color }, index) => (
        <span
          key={index}
          style={style}
          className={cn("absolute rounded-sm border-2 border-kid-ink", color)}
        />
      ))}
    </div>
  );
}

const countRules = new Intl.PluralRules(MONTENEGRIN);

/** "Sad znaš još 4 nove riječi.": the noun in Montenegrin's accusative forms. */
export function wordsLearnedText(count: number): string {
  const words =
    {
      one: "novu riječ",
      few: "nove riječi",
    }[countRules.select(count) as "one" | "few"] ?? "novih riječi";
  return `Sad znaš još ${count} ${words}.`;
}

/** "+3 zvjezdice": 1 (21, …) zvjezdica, 2–4 zvjezdice, the rest zvjezdica. */
export function starsText(count: number): string {
  const noun = countRules.select(count) === "few" ? "zvjezdice" : "zvjezdica";
  return `+${count} ${noun}`;
}
