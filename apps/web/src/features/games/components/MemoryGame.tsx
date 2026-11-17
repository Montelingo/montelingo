"use client";

import { useEffect, useReducer } from "react";

import { FOCUS_RING } from "@/components/ui/kid-styles";
import { CONTENT_LANG } from "@/features/map/edge";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import {
  type CardFace,
  cardFace,
  createMemoryGame,
  isMissShowing,
  type MemoryCard,
  memoryReducer,
  type MemoryState,
  type MemoryWord,
  type Random,
} from "../model/memory";

export type MemoryGameProps = {
  /**
   * The chapter's words. The game is dealt once, when it mounts, so a new
   * chapter needs a new `key`.
   */
  words: readonly MemoryWord[];
  /** Shuffles the deal. Tests pass their own, so a deal repeats. */
  random?: Random;
};

const NO_GAME: MemoryState = { cards: [], faceUp: [], matched: [] };

/** How long a miss stays turned over, so the child sees both pictures. */
export const MISS_DELAY_MS = 1000;

// A chapter's memory game (#132, ADR 0006): #131's model on a board of up to
// 12 cards. It takes the chapter's words and does no fetching; the route
// (#135) loads them. The copy is Montenegrin, so the board carries the
// content's language.
export function MemoryGame({ words, random = Math.random }: MemoryGameProps) {
  const [state, dispatch] = useReducer(
    memoryReducer,
    undefined,
    () => createMemoryGame(words, random) ?? NO_GAME,
  );
  const missShowing = isMissShowing(state);

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

  if (state.cards.length === 0) {
    return null;
  }

  return (
    <div
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
