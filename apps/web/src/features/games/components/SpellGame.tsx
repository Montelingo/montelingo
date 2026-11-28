"use client";

import { preload } from "react-dom";
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

import { useFocusOnNewButtons } from "../hooks/use-focus-on-new-buttons";
import { useGameVisit } from "../hooks/use-game-visit";
import {
  createSpellGame,
  currentRound,
  isComplete,
  type SpellRound,
  spellReducer,
  type SpellState,
  type SpellTile,
  type SpellWord,
} from "../model/spell";
import { BravoScreen } from "./BravoScreen";

export type SpellGameProps = {
  /**
   * The learned words to deal from. The game is dealt when it mounts and
   * again on "Igraj ponovo".
   */
  words: readonly SpellWord[];
  /** Where the way back leads from "Bravo!": Riječi. */
  placeHref: string;
  /** The way back's label. */
  backLabel: string;
  /**
   * Called when the last word is spelled. Sastavi riječi is practice only
   * (#294), so it is called for every game played to the end, "Igraj
   * ponovo"'s too.
   */
  onCompleted?: () => void;
  /** The learner's name, for "Bravo, Mia!". Without it, "Bravo!". */
  learnerName?: string;
  /** Shown on every "Bravo!" screen when the result did not save, with its retry. */
  saveNotice?: ReactNode;
  /** Shuffles the deal. Tests pass their own, so a deal repeats. */
  random?: Random;
};

const NO_GAME: SpellState = {
  rounds: [],
  current: 0,
  placed: [],
  bounced: null,
  bounces: 0,
  isSolved: false,
};

/** How long the spelled word shows before the next one, so the child reads it. */
export const SOLVED_DELAY_MS = 1200;

// Sastavi riječi (#297, ADR 0006): a learned word's picture, an empty slot per
// letter, and the word's letters as shuffled tiles. The child taps them in
// order: a right tile fills the next slot, a wrong one shakes, its border
// turns red until the next right tile, and it stays tappable (with
// `prefers-reduced-motion`, only the border shows). No figure, no
// lives, no score. Five words, shortest first, then "Bravo!". Practice only,
// from Riječi; it takes its words and does no fetching.
//
// As in MatchGame, the deal is random, so it is made in the browser only,
// and "Igraj ponovo" mounts the rounds again under a new key.
export function SpellGame({
  words,
  placeHref,
  backLabel,
  onCompleted,
  learnerName,
  saveNotice,
  random = Math.random,
}: SpellGameProps) {
  const isHydrated = useIsHydrated();
  const [isDone, setIsDone] = useState(false);
  const { game, isReplay, playAgain } = useGameVisit(isDone, onCompleted, true);

  const handleComplete = useCallback(() => {
    setIsDone(true);
  }, []);

  if (isDone) {
    return (
      <BravoScreen
        message="Sve riječi su složene!"
        placeHref={placeHref}
        backLabel={backLabel}
        learnerName={learnerName}
        reward={null}
        saveNotice={saveNotice}
        onPlayAgain={() => {
          playAgain();
          setIsDone(false);
        }}
      />
    );
  }

  if (!isHydrated) {
    return null;
  }

  return (
    <Rounds
      key={game}
      words={words}
      random={random}
      shouldFocusFirstOnMount={isReplay}
      onComplete={handleComplete}
    />
  );
}

type RoundsProps = {
  words: readonly SpellWord[];
  random: Random;
  /** After "Igraj ponovo" the focus was on a button that is gone. */
  shouldFocusFirstOnMount: boolean;
  onComplete: () => void;
};

// One game: its rounds, dealt once, when it mounts.
function Rounds({
  words,
  random,
  shouldFocusFirstOnMount,
  onComplete,
}: RoundsProps) {
  const [state, dispatch] = useReducer(
    spellReducer,
    undefined,
    () => createSpellGame(words, random) ?? NO_GAME,
  );
  const round = currentRound(state);
  const isGameComplete = isComplete(state);

  // The spelled word shows a moment, then the next one (or "Bravo!").
  useEffect(() => {
    if (!state.isSolved) {
      return;
    }
    const timer = setTimeout(() => dispatch({ type: "next" }), SOLVED_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.isSolved]);

  useEffect(() => {
    if (isGameComplete) {
      onComplete();
    }
  }, [isGameComplete, onComplete]);

  // The tiles are new buttons each round.
  const tilesRef = useRef<HTMLDivElement>(null);
  useFocusOnNewButtons(tilesRef, state.current, shouldFocusFirstOnMount);

  const upcoming = state.rounds[state.current + 1];
  if (upcoming !== undefined) {
    preload(upcoming.imageUrl, { as: "image" });
  }

  if (round === null) {
    return null;
  }
  const word = round.letters.join("");

  return (
    <div
      role="group"
      aria-label="Sastavi riječ za sliku"
      lang={CONTENT_LANG}
      className={cn(
        fredoka.className,
        "flex min-h-0 flex-1 flex-col gap-4 text-kid-ink",
      )}
    >
      <Steps count={state.rounds.length} current={state.current} />

      <div className="relative min-h-0 flex-1 rounded-kid-lg border-3 border-kid-line bg-white shadow-raised-line-4">
        <div role="img" aria-label={word} className="absolute inset-4">
          {/* Word images are same-origin WebP files at their final size
              (public/media/words), so next/image would add nothing. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img
            key={round.wordId}
            src={round.imageUrl}
            alt=""
            draggable={false}
            decoding="async"
            className="size-full object-contain"
          />
        </div>
      </div>

      <Slots round={round} state={state} />

      <div
        ref={tilesRef}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        {round.tiles.map((tile) => (
          <TileButton
            key={tile.id}
            tile={tile}
            isPlaced={state.placed.includes(tile.id)}
            isLocked={state.isSolved}
            bounce={state.bounced === tile.id ? state.bounces : null}
            onTap={() => dispatch({ type: "tap", tileId: tile.id })}
          />
        ))}
      </div>

      <p role="status" className="sr-only">
        {statusText(state, round)}
      </p>
    </div>
  );
}

/**
 * What a screen reader hears: the word so far, a wrong tile, the spelled
 * word, or which word it is, since the steps and slots are hidden from it.
 */
function statusText(state: SpellState, round: SpellRound): string {
  if (state.isSolved) {
    return `Tačno! ${lower(round.letters.join(""))}`;
  }
  if (state.bounced !== null) {
    return "Pokušaj ponovo.";
  }
  if (state.placed.length > 0) {
    return lower(round.letters.slice(0, state.placed.length).join(" "));
  }
  return `Riječ ${state.current + 1} od ${state.rounds.length}`;
}

function lower(text: string): string {
  return text.toLocaleLowerCase(CONTENT_LANG);
}

type SlotsProps = {
  round: SpellRound;
  state: SpellState;
};

// One slot per letter: the filled ones show their letter, the next one is
// outlined dark. All green once the word is spelled.
function Slots({ round, state }: SlotsProps) {
  const filled = state.placed.length;
  return (
    <div
      aria-hidden="true"
      data-testid="spell-slots"
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {round.letters.map((letter, slot) => (
        <span
          key={`${state.current}-${slot}`}
          data-filled={slot < filled}
          className={cn(
            "flex h-16 min-w-12 items-center justify-center rounded-kid border-3 px-2",
            "text-4xl font-semibold leading-none md:h-20 md:min-w-16 md:text-5xl",
            slot < filled ? "border-kid-ink bg-white" : "border-dashed",
            slot === filled && !state.isSolved && "border-kid-ink",
            slot > filled && "border-kid-muted",
            state.isSolved && "bg-kid-green",
          )}
        >
          {slot < filled ? lower(letter) : null}
        </span>
      ))}
    </div>
  );
}

type TileButtonProps = {
  tile: SpellTile;
  /** In its slot: it stays, faded, so the keyboard focus is not lost. */
  isPlaced: boolean;
  /** The word is spelled: no tile takes a tap until the next word. */
  isLocked: boolean;
  /** The bounce count while this tile is the one that bounced, else `null`. */
  bounce: number | null;
  onTap: () => void;
};

// A letter, large and lowercase. A tile that cannot be tapped stays
// focusable (aria-disabled), as a set-aside word does in MatchGame. Its
// letter shakes when it bounces: the inner span takes a new key each bounce,
// so the shake plays again, while the button, and its focus, stay.
function TileButton({
  tile,
  isPlaced,
  isLocked,
  bounce,
  onTap,
}: TileButtonProps) {
  const isDisabled = isPlaced || isLocked;
  return (
    <button
      type="button"
      aria-disabled={isDisabled}
      onClick={isDisabled ? undefined : onTap}
      className={cn(
        "flex size-touch-xl items-center justify-center rounded-kid-lg border-3",
        "text-4xl font-semibold leading-none md:text-5xl",
        "aria-disabled:cursor-default",
        FOCUS_RING,
        isPlaced
          ? "border-kid-line bg-white opacity-30"
          : "border-kid-ink bg-white shadow-raised-4",
        bounce !== null && "border-kid-red",
      )}
    >
      <span
        key={bounce ?? "still"}
        className={cn(
          "inline-block",
          bounce !== null && "motion-safe:animate-wiggle",
        )}
      >
        {lower(tile.letter)}
      </span>
    </button>
  );
}

type StepsProps = {
  count: number;
  /** The word on screen, from 0. */
  current: number;
};

// The game's five steps, one bar each: the done ones green, the current one
// dark. Hidden from screen readers, which hear "Riječ 2 od 5".
function Steps({ count, current }: StepsProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="spell-steps"
      className="flex items-center gap-2"
    >
      {Array.from({ length: count }, (_, step) => (
        <span
          key={step}
          data-current={step === current}
          data-done={step < current}
          className={cn(
            "h-3 flex-1 rounded-full transition motion-reduce:transition-none",
            step < current && "bg-kid-green",
            step === current && "bg-kid-ink",
            step > current && "border-2 border-kid-muted bg-white",
          )}
        />
      ))}
    </div>
  );
}
