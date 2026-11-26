"use client";

import { CheckIcon } from "@heroicons/react/24/solid";
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
import { SETTLE_DELAY_MS } from "@/lib/use-settled";

import {
  createMatchGame,
  currentRound,
  isComplete,
  type MatchOption,
  matchReducer,
  type MatchRound,
  type MatchState,
  type MatchWord,
} from "../model/match";
import { useFocusOnNewButtons } from "../hooks/use-focus-on-new-buttons";
import { useGameVisit } from "../hooks/use-game-visit";
import {
  BACK_TO_PLACE,
  BravoScreen,
  type GameReward,
  wordsLearnedText,
} from "./BravoScreen";

export type MatchGameProps = {
  /**
   * The chapter's words. The game is dealt when it mounts and again on "Igraj
   * ponovo", so a new chapter needs a new `key`.
   */
  words: readonly MatchWord[];
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
   * Called once, when the last round is solved: the game then counts as
   * played (ADR 0006). Playing again does not call it a second time.
   */
  onCompleted?: () => void;
  /** The learner's name, for "Bravo, Mia!". Without it, "Bravo!". */
  learnerName?: string;
  /**
   * The place's sticker, when this game completes the place. Only the first
   * "Bravo!" screen shows it.
   */
  reward?: GameReward | null;
  /**
   * Shown on every "Bravo!" screen when the result did not save, with its
   * retry: the route's, since the game does no fetching.
   */
  saveNotice?: ReactNode;
  /**
   * How many rounds to play, at most, with words chosen at random; the rest
   * can still be wrong words. Without it, a round per word with a picture.
   */
  rounds?: number;
  /** Shuffles the deal. Tests pass their own, so a deal repeats. */
  random?: Random;
};

const NO_GAME: MatchState = {
  rounds: [],
  current: 0,
  wrong: [],
  isSolved: false,
};

/** How long the right word shows before the next round, so the child sees it. */
export const RIGHT_DELAY_MS = 900;

/** How long the "Bravo!" buttons ignore presses after the screen appears. */
export { SETTLE_DELAY_MS };

// A chapter's match game (#137, ADR 0006): one picture and three written
// words, and the child taps the word for the picture. A wrong word wobbles,
// fades and is set aside, and the child picks again; the right one turns
// green and the next round comes. No score. After the last round, "Bravo!".
// It takes the chapter's words and does no fetching; the route loads them.
//
// "Igraj ponovo" deals a new game: the rounds mount again under a new key, so
// they shuffle again and keep no state from the last game.
//
// The deal is random, so it is made in the browser only: the server's HTML
// and the hydrating render would deal differently, and React keeps the
// server's pictures where they differ. Until the page hydrates there is no
// round; after a client-side navigation it is there at once.
export function MatchGame({
  words,
  placeHref,
  backLabel = BACK_TO_PLACE,
  teachesWords = true,
  onCompleted,
  rounds: roundCap,
  learnerName,
  reward,
  saveNotice,
  random = Math.random,
}: MatchGameProps) {
  const isHydrated = useIsHydrated();
  // The number of rounds played, once the last one is solved.
  const [rounds, setRounds] = useState<number | null>(null);
  const { game, isReplay, playAgain } = useGameVisit(
    rounds !== null,
    onCompleted,
  );

  const handleComplete = useCallback((count: number) => {
    setRounds(count);
  }, []);

  if (rounds !== null) {
    return (
      <BravoScreen
        message={
          isReplay || !teachesWords
            ? "Sve riječi su pronađene!"
            : wordsLearnedText(rounds)
        }
        placeHref={placeHref}
        backLabel={backLabel}
        learnerName={learnerName}
        reward={isReplay ? null : (reward ?? null)}
        saveNotice={saveNotice}
        onPlayAgain={() => {
          playAgain();
          setRounds(null);
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
      cap={roundCap}
      random={random}
      shouldFocusFirstOnMount={isReplay}
      onComplete={handleComplete}
    />
  );
}

type RoundsProps = {
  words: readonly MatchWord[];
  cap: number | undefined;
  random: Random;
  /** After "Igraj ponovo" the focus was on a button that is gone. */
  shouldFocusFirstOnMount: boolean;
  /** Called when the last round is solved, with the number of rounds. */
  onComplete: (rounds: number) => void;
};

// One game: its rounds, dealt once, when it mounts.
function Rounds({
  words,
  cap,
  random,
  shouldFocusFirstOnMount,
  onComplete,
}: RoundsProps) {
  const [state, dispatch] = useReducer(
    matchReducer,
    undefined,
    () => createMatchGame(words, random, { rounds: cap }) ?? NO_GAME,
  );
  const round = currentRound(state);
  const isGameComplete = isComplete(state);
  const count = state.rounds.length;

  // The right word shows a moment, then the next round (or "Bravo!").
  useEffect(() => {
    if (!state.isSolved) {
      return;
    }
    const timer = setTimeout(() => dispatch({ type: "next" }), RIGHT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [state.isSolved]);

  useEffect(() => {
    if (isGameComplete) {
      onComplete(count);
    }
  }, [isGameComplete, count, onComplete]);

  // The words are new buttons each round.
  const optionsRef = useRef<HTMLDivElement>(null);
  useFocusOnNewButtons(optionsRef, state.current, shouldFocusFirstOnMount);

  // Fetch the next picture while this one is on screen, so it is there at once.
  const upcoming = state.rounds[state.current + 1];
  if (upcoming !== undefined) {
    preload(upcoming.imageUrl, { as: "image" });
  }

  if (round === null) {
    return null;
  }
  const word = round.options.find((option) => option.wordId === round.wordId);

  return (
    <div
      role="group"
      aria-label="Spoji riječ i sliku"
      lang={CONTENT_LANG}
      className={cn(
        fredoka.className,
        "flex min-h-0 flex-1 flex-col gap-4 text-kid-ink",
      )}
    >
      <RoundDots count={count} current={state.current} />

      <div className="relative min-h-0 flex-1 rounded-kid-lg border-3 border-kid-line bg-white shadow-raised-line-4">
        {/* Named by its word, as the lesson's picture is, so a screen reader
            hears what the child sees. */}
        <div role="img" aria-label={word?.text} className="absolute inset-4">
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

      <p className="text-center text-base font-medium text-kid-muted">
        Koja riječ ide uz sliku?
      </p>

      <div ref={optionsRef} className="grid gap-3 landscape:grid-cols-3">
        {round.options.map((option) => (
          <OptionButton
            key={`${state.current}-${option.wordId}`}
            option={option}
            look={optionLook(state, round, option.wordId)}
            isLocked={state.isSolved}
            onPick={() => dispatch({ type: "pick", wordId: option.wordId })}
          />
        ))}
      </div>

      <p role="status" className="sr-only">
        {statusText(state)}
      </p>
    </div>
  );
}

type OptionLook = "open" | "wrong" | "right";

/** How a word on offer shows: set aside, the solved round's answer, or open. */
function optionLook(
  state: MatchState,
  round: MatchRound,
  wordId: string,
): OptionLook {
  if (state.wrong.includes(wordId)) {
    return "wrong";
  }
  return state.isSolved && wordId === round.wordId ? "right" : "open";
}

/**
 * What a screen reader hears, as text: how the pick went, or which round it
 * is, since the dots are hidden from it.
 */
function statusText(state: MatchState): string {
  if (state.isSolved) {
    return "Tačno!";
  }
  if (state.wrong.length > 0) {
    return "Pokušaj ponovo.";
  }
  return `Slika ${state.current + 1} od ${state.rounds.length}`;
}

type OptionButtonProps = {
  option: MatchOption;
  look: OptionLook;
  /** The round is solved: no word takes a tap until the next round. */
  isLocked: boolean;
  onPick: () => void;
};

// A word, large and lowercase. A wrong one wobbles once and fades (with
// `prefers-reduced-motion`, it only fades); the right one turns green with a
// tick. A word that cannot be tapped stays focusable (aria-disabled), so the
// keyboard focus is not lost.
function OptionButton({ option, look, isLocked, onPick }: OptionButtonProps) {
  const isDisabled = isLocked || look !== "open";
  return (
    <button
      type="button"
      aria-disabled={isDisabled}
      onClick={isDisabled ? undefined : onPick}
      className={cn(
        "flex min-h-touch-xl items-center justify-center gap-2 rounded-kid-lg border-3 px-4 py-2",
        "text-balance break-words text-4xl font-semibold leading-tight md:text-5xl",
        "aria-disabled:cursor-default",
        FOCUS_RING,
        look === "open" && "border-kid-ink bg-white shadow-raised-4",
        look === "right" && "border-kid-ink bg-kid-green shadow-raised-4",
        look === "wrong" &&
          "border-kid-line bg-white opacity-40 transition-opacity duration-300 motion-safe:animate-wiggle motion-safe:delay-300",
      )}
    >
      {look === "right" ? (
        <CheckIcon aria-hidden="true" className="size-9 shrink-0" />
      ) : null}
      {option.text.toLocaleLowerCase(CONTENT_LANG)}
    </button>
  );
}

type RoundDotsProps = {
  count: number;
  /** The round on screen, from 0. */
  current: number;
};

// One dot per round: the done ones filled, the current one large and dark.
// Hidden from screen readers, which hear "Slika 3 od 10" in the status line.
function RoundDots({ count, current }: RoundDotsProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="match-dots"
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {Array.from({ length: count }, (_, dot) => (
        <span
          key={dot}
          data-current={dot === current}
          data-done={dot < current}
          className={cn(
            "size-3 rounded-full transition motion-reduce:transition-none",
            dot === current && "scale-150 bg-kid-ink",
            dot < current && "bg-kid-green",
            dot > current && "border-2 border-kid-muted bg-white",
          )}
        />
      ))}
    </div>
  );
}
