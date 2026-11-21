"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { BIG_BUTTON, FOCUS_RING } from "@/components/ui/kid-styles";
import { CONTENT_LANG, PlaceStickerArt } from "@/features/map/edge";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";
import { MONTENEGRIN } from "@/lib/locale";
import { SETTLE_DELAY_MS, useSettled } from "@/lib/use-settled";

import {
  type CardFace,
  cardFace,
  createMemoryGame,
  isComplete,
  isMissShowing,
  type MemoryCard,
  memoryReducer,
  type MemoryState,
  type MemoryWord,
  type Random,
} from "../model/memory";

/** The sticker a game gives when it completes its place. */
export type MemoryReward = {
  /** The place's id: the sticker is the map's art around it. */
  placeId: string;
  /** The place's name, the sticker's name. */
  name: string;
  /** Stars the place gives. */
  stars: number;
};

export type MemoryGameProps = {
  /**
   * The chapter's words. The game is dealt when it mounts and again on "Igraj
   * ponovo", so a new chapter needs a new `key`.
   */
  words: readonly MemoryWord[];
  /** The place's screen, where "Nazad na mjesto" leads from "Bravo!". */
  placeHref: string;
  /**
   * Called once, when every pair is found: the game then counts as played
   * (ADR 0006). Playing again does not call it a second time.
   */
  onCompleted?: () => void;
  /** The learner's name, for "Bravo, Mia!". Without it, "Bravo!". */
  learnerName?: string;
  /**
   * The place's sticker, when this game completes the place. The first
   * "Bravo!" screen shows it; a second game gives nothing new, so its "Bravo!"
   * leaves the card and the new words out.
   */
  reward?: MemoryReward | null;
  /** Shuffles the deal. Tests pass their own, so a deal repeats. */
  random?: Random;
};

const NO_GAME: MemoryState = { cards: [], faceUp: [], matched: [] };

/** How long a miss stays turned over, so the child sees both pictures. */
export const MISS_DELAY_MS = 1000;

/** How long the last pair shows before "Bravo!", so the child sees it. */
export const BRAVO_DELAY_MS = 800;

/** How long the "Bravo!" buttons ignore presses after the screen appears. */
export { SETTLE_DELAY_MS };

type Phase = "playing" | "complete" | "bravo";

// A chapter's memory game (#132, #133, ADR 0006): #131's model on a board of
// up to 12 cards, then a "Bravo!" screen once every pair is found. It takes
// the chapter's words and does no fetching; the route (#135) loads them. The
// copy is Montenegrin, so the game carries the content's language.
//
// "Igraj ponovo" deals a new game: the board mounts again under a new key, so
// it shuffles again and keeps no state from the last round.
export function MemoryGame({
  words,
  placeHref,
  onCompleted,
  learnerName,
  reward,
  random = Math.random,
}: MemoryGameProps) {
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  const [pairs, setPairs] = useState(0);

  const handleComplete = useCallback((found: number) => {
    setPairs(found);
    setPhase((current) => (current === "playing" ? "complete" : current));
  }, []);

  // The last pair stays on the board a moment, then "Bravo!".
  useEffect(() => {
    if (phase !== "complete") {
      return;
    }
    const timer = setTimeout(() => setPhase("bravo"), BRAVO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // The game is reported once per visit, however often it is played again.
  const reported = useRef(false);
  useEffect(() => {
    // Marked only when called, so a callback passed in late still runs.
    if (phase !== "playing" && !reported.current && onCompleted !== undefined) {
      reported.current = true;
      onCompleted();
    }
  }, [phase, onCompleted]);

  if (phase === "bravo") {
    return (
      <BravoScreen
        pairs={pairs}
        replay={round > 0}
        placeHref={placeHref}
        learnerName={learnerName}
        reward={round > 0 ? null : (reward ?? null)}
        onPlayAgain={() => {
          setRound((current) => current + 1);
          setPhase("playing");
        }}
      />
    );
  }

  return (
    <Board
      key={round}
      words={words}
      random={random}
      focusFirstOnMount={round > 0}
      onComplete={handleComplete}
    />
  );
}

type BoardProps = {
  words: readonly MemoryWord[];
  random: Random;
  /** After "Igraj ponovo" the focus was on a button that is gone. */
  focusFirstOnMount: boolean;
  /** Called when every pair is found, with the number of pairs. */
  onComplete: (pairs: number) => void;
};

// One round: the cards, dealt once, when the board mounts.
function Board({ words, random, focusFirstOnMount, onComplete }: BoardProps) {
  const [state, dispatch] = useReducer(
    memoryReducer,
    undefined,
    () => createMemoryGame(words, random) ?? NO_GAME,
  );
  const missShowing = isMissShowing(state);
  const complete = isComplete(state);
  const pairs = state.cards.length / 2;

  useEffect(() => {
    if (!missShowing) {
      return;
    }
    const timer = setTimeout(
      () => dispatch({ type: "hide-miss" }),
      MISS_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [missShowing]);

  useEffect(() => {
    if (complete) {
      onComplete(pairs);
    }
  }, [complete, pairs, onComplete]);

  const boardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusFirstOnMount) {
      boardRef.current?.querySelector("button")?.focus();
    }
    // Only on mount: a new deal is a new board.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, []);

  if (state.cards.length === 0) {
    return null;
  }

  return (
    <div
      ref={boardRef}
      role="group"
      aria-label="Memorija"
      lang={CONTENT_LANG}
      className={cn(
        fredoka.className,
        "grid min-h-0 flex-1 grid-cols-3 grid-rows-4 gap-3 text-kid-ink",
        "landscape:grid-cols-4 landscape:grid-rows-3",
      )}
    >
      {state.cards.map((card, index) => (
        <Card
          key={card.id}
          card={card}
          position={index + 1}
          face={cardFace(state, card.id)}
          locked={missShowing}
          onFlip={() => dispatch({ type: "flip", cardId: card.id })}
        />
      ))}
    </div>
  );
}

type CardProps = {
  card: MemoryCard;
  /** The card's place on the board, from 1: its name while face down. */
  position: number;
  face: CardFace;
  /** A miss is showing: no card turns until it is turned back. */
  locked: boolean;
  onFlip: () => void;
};

// Both sides of a card, back to back on a part that turns about its upright
// axis. The turn animates only when the device allows motion; with
// `prefers-reduced-motion` the picture simply appears. The picture is on the
// board from the start, so it shows the moment the card turns.
//
// Only a face-down card turns, and none while a miss shows. A card that cannot
// turn stays focusable (aria-disabled), so the keyboard focus is not lost.
function Card({ card, position, face, locked, onFlip }: CardProps) {
  const disabled = locked || face !== "down";
  return (
    <button
      type="button"
      aria-label={cardLabel(card, position, face)}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onFlip}
      className={cn(
        "min-h-0 rounded-kid-lg [perspective:60rem] aria-disabled:cursor-default",
        FOCUS_RING,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative block size-full [transform-style:preserve-3d]",
          "motion-safe:transition-transform motion-safe:duration-300",
          face !== "down" && "[transform:rotateY(180deg)]",
        )}
      >
        <span className="absolute inset-0 flex items-center justify-center rounded-kid-lg border-3 border-kid-ink bg-kid-sea text-5xl font-semibold text-kid-ink shadow-raised-4 [backface-visibility:hidden]">
          ?
        </span>
        <span
          className={cn(
            "absolute inset-0 flex flex-col rounded-kid-lg border-3 bg-white p-2 [backface-visibility:hidden] [transform:rotateY(180deg)]",
            face === "matched"
              ? "border-kid-green shadow-raised-4"
              : "border-kid-line shadow-raised-line-4",
          )}
        >
          {/* Word images are same-origin WebP files at their final size
              (public/media/words), so next/image would add nothing. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img
            src={card.imageUrl}
            alt=""
            draggable={false}
            decoding="async"
            className="min-h-0 flex-1 object-contain"
          />
          {face === "matched" && (
            <span className="text-center text-xl font-semibold md:text-2xl">
              {card.text.toLocaleLowerCase(CONTENT_LANG)}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

// What a screen reader hears: where a face-down card is, and what a turned
// card shows, so the game can be played without seeing the pictures.
function cardLabel(card: MemoryCard, position: number, face: CardFace): string {
  switch (face) {
    case "down":
      return `karta ${position}, licem dolje`;
    case "up":
      return card.text;
    case "matched":
      return `${card.text}, par pronađen`;
  }
}

type BravoScreenProps = {
  pairs: number;
  /** A second game or later: the words are not new any more. */
  replay: boolean;
  placeHref: string;
  learnerName: string | undefined;
  reward: MemoryReward | null;
  onPlayAgain: () => void;
};

// Figma "TM5 · Result – stars": the sea, a little confetti, three stars, the
// praise and how many words the child now knows, the place's sticker when the
// game completed the place, and at the bottom the way back and "Igraj
// ponovo". The heading takes the focus, so a screen reader hears "Bravo!" at
// once. The buttons wait a moment, so a tap still meant for a card does not
// press one.
function BravoScreen({
  pairs,
  replay,
  placeHref,
  learnerName,
  reward,
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
          <p className="text-xl font-medium">
            {replay ? "Svi parovi su pronađeni!" : wordsLearnedText(pairs)}
          </p>
          {reward !== null ? <RewardCard reward={reward} /> : null}
        </div>
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
function RewardCard({ reward }: { reward: MemoryReward }) {
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
