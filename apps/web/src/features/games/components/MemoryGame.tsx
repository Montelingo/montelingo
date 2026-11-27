"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";

import { FOCUS_RING } from "@/components/ui/kid-styles";
import { CONTENT_LANG } from "@/features/map/edge";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";
import type { Random } from "@/lib/random";
import { useIsHydrated } from "@/lib/use-is-hydrated";
import { SETTLE_DELAY_MS } from "@/lib/use-settled";

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
} from "../model/memory";
import { useGameVisit } from "../hooks/use-game-visit";
import {
  BACK_TO_PLACE,
  BravoScreen,
  type GameReward,
  wordsLearnedText,
} from "./BravoScreen";

export type MemoryGameProps = {
  /**
   * The chapter's words. The game is dealt when it mounts and again on "Igraj
   * ponovo", so a new chapter needs a new `key`.
   */
  words: readonly MemoryWord[];
  /**
   * Where the way back leads from "Bravo!": the place's screen, or for
   * practice, Riječi.
   */
  placeHref: string;
  /** The way back's label: "Nazad na mjesto" unless given. */
  backLabel?: string;
  /**
   * Whether finishing teaches new words, as a chapter's game does. Practice
   * plays words the child already knows, so its "Bravo!" only praises.
   */
  teachesWords?: boolean;
  /**
   * Called once, when every pair is found: the game then counts as played
   * (ADR 0006). Playing again does not call it a second time.
   */
  onCompleted?: () => void;
  /**
   * Calls `onCompleted` for every game played to the end, not only the
   * first: practice records each one (ADR 0009).
   */
  reportsEveryGame?: boolean;
  /** The learner's name, for "Bravo, Mia!". Without it, "Bravo!". */
  learnerName?: string;
  /**
   * The place's sticker, when this game completes the place. The first
   * "Bravo!" screen shows it; a second game gives nothing new, so its "Bravo!"
   * leaves the card and the new words out.
   */
  reward?: GameReward | null;
  /**
   * Shown on every "Bravo!" screen when the result did not save, with its
   * retry: the route's, since the game does no fetching.
   */
  saveNotice?: ReactNode;
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
//
// The deal is random, so it is made in the browser only: the server's HTML
// and the hydrating render would deal differently, and React keeps the
// server's pictures where they differ. Until the page hydrates there is no
// board; after a client-side navigation it is there at once.
export function MemoryGame({
  words,
  placeHref,
  backLabel = BACK_TO_PLACE,
  teachesWords = true,
  onCompleted,
  reportsEveryGame = false,
  learnerName,
  reward,
  saveNotice,
  random = Math.random,
}: MemoryGameProps) {
  const isHydrated = useIsHydrated();
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

  const { game, isReplay, playAgain } = useGameVisit(
    phase !== "playing",
    onCompleted,
    reportsEveryGame,
  );

  if (phase === "bravo") {
    return (
      <BravoScreen
        message={
          isReplay || !teachesWords
            ? "Svi parovi su pronađeni!"
            : wordsLearnedText(pairs)
        }
        placeHref={placeHref}
        backLabel={backLabel}
        learnerName={learnerName}
        reward={isReplay ? null : (reward ?? null)}
        saveNotice={saveNotice}
        onPlayAgain={() => {
          playAgain();
          setPhase("playing");
        }}
      />
    );
  }

  if (!isHydrated) {
    return null;
  }

  return (
    <Board
      key={game}
      words={words}
      random={random}
      shouldFocusFirstOnMount={isReplay}
      onComplete={handleComplete}
    />
  );
}

type BoardProps = {
  words: readonly MemoryWord[];
  random: Random;
  /** After "Igraj ponovo" the focus was on a button that is gone. */
  shouldFocusFirstOnMount: boolean;
  /** Called when every pair is found, with the number of pairs. */
  onComplete: (pairs: number) => void;
};

// One round: the cards, dealt once, when the board mounts.
function Board({
  words,
  random,
  shouldFocusFirstOnMount,
  onComplete,
}: BoardProps) {
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
    if (shouldFocusFirstOnMount) {
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
