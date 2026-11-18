"use client";

import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import Link from "next/link";
import {
  type Dispatch,
  type ReactNode,
  type Ref,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { preload } from "react-dom";
import { useSwipeable } from "react-swipeable";

import { BIG_BUTTON, FOCUS_RING } from "@/components/ui/kid-styles";
import { PlaceholderArt } from "@/components/ui/PlaceholderArt";
import { CONTENT_LANG } from "@/features/map/edge";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import {
  cardIndex,
  cardPositionLabel,
  INITIAL_LESSON,
  isFirstCard,
  type LessonAction,
  LESSON_MODES,
  type LessonMode,
  lessonReducer,
  type LessonState,
  type LessonWord,
} from "../model/lesson";

export type LessonCardsProps = {
  /**
   * The chapter's words, in recording order. The lesson keeps its place while
   * it is on screen, so a new chapter needs a new `key`.
   */
  words: readonly LessonWord[];
  /** The place's screen, where "Nazad na mjesto" leads after the last card. */
  placeHref: string;
  /**
   * Called once, when the "Bravo!" screen first shows after the last card.
   * Watching again does not call it a second time.
   */
  onFinished?: () => void;
};

const MODE_LABELS: Record<LessonMode, string> = {
  pictures: "Slike",
  words: "Riječi",
};

const KEY_ACTIONS: Partial<Record<string, LessonAction>> = {
  ArrowRight: { type: "next" },
  ArrowLeft: { type: "back" },
};

// A swipe must travel this far (CSS px) to turn the card; less is a tap.
const SWIPE_DISTANCE = 40;

/**
 * How long a screen ignores presses after it appears. A child tapping quickly
 * through the cards would otherwise press a "Bravo!" button with the tap after
 * the last card, and a held Enter on "Pogledaj ponovo" would repeat on Next.
 */
export const SETTLE_DELAY_MS = 600;

// A chapter's lesson (ADR 0006): one large card, the picture alone or the word
// alone, then a "Bravo!" screen after the last card. The copy is Montenegrin,
// so the lesson carries the content's language.
export function LessonCards({
  words,
  placeHref,
  onFinished,
}: LessonCardsProps) {
  const count = words.length;
  // The reducer reads the current number of words, so it is never stale.
  const [state, dispatch] = useReducer(
    (current: LessonState, action: LessonAction) =>
      lessonReducer(current, action, count),
    INITIAL_LESSON,
  );
  const { finished } = state;

  // The lesson is reported once per visit, however often it is watched again.
  const reported = useRef(false);
  useEffect(() => {
    // Marked only when called, so a callback passed in late still runs.
    if (finished && !reported.current && onFinished !== undefined) {
      reported.current = true;
      onFinished();
    }
  }, [finished, onFinished]);

  if (count === 0) {
    return null;
  }

  return (
    <div
      lang={CONTENT_LANG}
      className={cn(fredoka.className, "flex flex-1 flex-col text-kid-ink")}
    >
      {finished ? (
        <FinishScreen
          placeHref={placeHref}
          onRestart={() => dispatch({ type: "restart" })}
        />
      ) : (
        <LessonScreen words={words} state={state} dispatch={dispatch} />
      )}
    </div>
  );
}

type LessonScreenProps = {
  words: readonly LessonWord[];
  state: LessonState;
  dispatch: Dispatch<LessonAction>;
};

// The cards themselves. A switch starts again from the first card (the second
// when the first is the word just shown), so a picture is never followed by
// its word. A row of dots shows the card; Next on the last card ends the
// lesson. Mounted only while a card is on screen, so its swipe, arrow keys and
// preloading stop on the "Bravo!" screen.
function LessonScreen({ words, state, dispatch }: LessonScreenProps) {
  const count = words.length;
  const index = cardIndex(state, count);
  const word = words[index];
  const next = () => dispatch({ type: "next" });
  const back = () => dispatch({ type: "back" });

  // After "Watch again" the focus was on a button that is gone: give it to
  // Next. Only on mount, as the cards mount again after "Watch again".
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const [focusNextOnMount] = useState(state.watchedToEnd);
  useEffect(() => {
    if (focusNextOnMount) {
      nextButtonRef.current?.focus();
    }
  }, [focusNextOnMount]);
  // There, Next waits a moment, so a held Enter does not skip cards.
  const settled = useSettled(SETTLE_DELAY_MS);
  const pressNext = () => {
    if (!focusNextOnMount || settled()) {
      next();
    }
  };

  // A swipe (with a finger, or a mouse drag) ends with a click on the card
  // when the mouse is let go: that click is the swipe's, not a tap for Next.
  const swiped = useRef(false);
  const swipe = useSwipeable({
    onTouchStartOrOnMouseDown: () => {
      swiped.current = false;
    },
    onSwiped: () => {
      swiped.current = true;
    },
    onSwipedLeft: next,
    onSwipedRight: back,
    delta: SWIPE_DISTANCE,
    trackMouse: true,
  });
  const handleCardClick = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    next();
  };

  // The arrow keys turn the card wherever the focus is: the lesson is the
  // whole screen, and nothing on it takes arrow keys.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditable(event.target)
      ) {
        return;
      }
      const action = KEY_ACTIONS[event.key];
      if (action !== undefined) {
        event.preventDefault();
        dispatch(action);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);

  // Fetch the next picture while this one is on screen, so it is there at once.
  const upcoming = words[index + 1];
  if (state.mode === "pictures" && upcoming?.imageUrl) {
    preload(upcoming.imageUrl, { as: "image" });
  }

  if (word === undefined) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div
        role="group"
        aria-label="Prikaz"
        className="flex self-center rounded-full border-3 border-kid-ink bg-white p-1 shadow-raised-4"
      >
        {LESSON_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={state.mode === mode}
            onClick={() => dispatch({ type: "mode", mode })}
            className={cn(
              "min-h-touch-lg min-w-32 rounded-full px-6 text-xl font-semibold",
              "aria-pressed:bg-kid-yellow aria-[pressed=false]:hover:bg-kid-fog",
              FOCUS_RING,
            )}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- a tap on the card is a pointer-only Next; on the keyboard, Next is the button and the right arrow key */}
      <div
        {...swipe}
        onClick={handleCardClick}
        className="relative min-h-0 flex-1 cursor-pointer touch-pan-y select-none overflow-hidden rounded-kid-lg border-3 border-kid-line bg-white shadow-raised-line-4"
      >
        <div className="absolute inset-0 flex">
          {state.mode === "pictures" ? (
            <PictureCard key={word.id} word={word} />
          ) : (
            <WordText key={word.id} word={word} />
          )}
        </div>
      </div>

      {/* Announced when the card changes, as text: screen readers announce a
          live region's text, not a picture's name. */}
      <p role="status" className="sr-only">
        {word.text}, {cardPositionLabel(state, count)}
      </p>

      <div className="flex items-center justify-between gap-4">
        <NavButton
          label="Nazad"
          disabled={isFirstCard(state, count)}
          onPress={back}
        >
          <ArrowLeftIcon aria-hidden="true" className="size-9" />
        </NavButton>
        <div className="flex min-w-0 flex-col items-center gap-2 text-center">
          <CardDots count={count} current={index} />
          <p className="text-base font-medium text-kid-muted">
            Pročitajte djetetu svaku riječ naglas.
          </p>
        </div>
        {/* On the last card, Next ends the lesson. */}
        <NavButton
          ref={nextButtonRef}
          label="Dalje"
          onPress={pressNext}
          primary
        >
          <ArrowRightIcon aria-hidden="true" className="size-9" />
        </NavButton>
      </div>
    </div>
  );
}

type CardProps = {
  word: LessonWord;
};

// The picture alone, as large as the card allows, never cropped. Its name is
// the word, so a screen reader hears what the child sees; nothing is written.
function PictureCard({ word }: CardProps) {
  return (
    <div role="img" aria-label={word.text} className="absolute inset-4">
      {word.imageUrl !== null ? (
        // Word images are same-origin WebP files at their final size
        // (public/media/words), so next/image would add nothing.
        // eslint-disable-next-line @next/next/no-img-element -- see above
        <img
          src={word.imageUrl}
          alt=""
          draggable={false}
          decoding="async"
          className="size-full object-contain"
        />
      ) : (
        // No letter on the stand-in either: the card shows no writing.
        <PlaceholderArt
          id={`word-${word.number}`}
          withInitial={false}
          className="rounded-kid"
        />
      )}
    </div>
  );
}

// The word alone, in large lowercase letters, centred on the card. The
// longest words (11 letters, "narandžasta") fit on one line on the iPad mini
// in portrait; two-word ones wrap.
function WordText({ word }: CardProps) {
  return (
    <p className="m-auto text-balance break-words px-8 text-center text-7xl font-semibold leading-tight md:text-8xl lg:text-9xl">
      {word.text.toLocaleLowerCase(CONTENT_LANG)}
    </p>
  );
}

type CardDotsProps = {
  count: number;
  /** The card on screen, from 0. */
  current: number;
};

// One dot per card, the current one large and dark. Hidden from screen
// readers, which hear "3 od 10" in the status line.
function CardDots({ count, current }: CardDotsProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="lesson-dots"
      className="flex flex-wrap items-center justify-center gap-2"
    >
      {Array.from({ length: count }, (_, dot) => (
        <span
          key={dot}
          data-current={dot === current}
          className={cn(
            "size-3 rounded-full transition motion-reduce:transition-none",
            dot === current
              ? "scale-150 bg-kid-ink"
              : "border-2 border-kid-muted bg-white",
          )}
        />
      ))}
    </div>
  );
}

type FinishScreenProps = {
  placeHref: string;
  onRestart: () => void;
};

// After the last card: praise, then the lesson again or back to the place.
// The heading takes the focus, so a screen reader hears "Bravo!" at once. The
// buttons wait a moment, so the tap after the last card does not press one.
function FinishScreen({ placeHref, onRestart }: FinishScreenProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const settled = useSettled(SETTLE_DELAY_MS);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8">
      <StarIcon aria-hidden="true" className="size-32 text-kid-yellow" />
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-7xl font-semibold focus:outline-none"
      >
        Bravo!
      </h2>
      <div className="flex w-full max-w-md flex-col gap-4">
        <button
          type="button"
          onClick={() => {
            if (settled()) {
              onRestart();
            }
          }}
          className={cn(BIG_BUTTON, "gap-3 bg-kid-yellow")}
        >
          <ArrowPathIcon aria-hidden="true" className="size-8" />
          Pogledaj ponovo
        </button>
        <Link
          href={placeHref}
          onClick={(event) => {
            if (!settled()) {
              event.preventDefault();
            }
          }}
          className={cn(BIG_BUTTON, "bg-white")}
        >
          Nazad na mjesto
        </Link>
      </div>
    </div>
  );
}

type NavButtonProps = {
  ref?: Ref<HTMLButtonElement>;
  label: string;
  disabled?: boolean;
  onPress: () => void;
  primary?: boolean;
  children: ReactNode;
};

// Next and Back: big round buttons. Back stays focusable on the first card
// (aria-disabled), so the keyboard focus is not lost when it stops working.
function NavButton({
  ref,
  label,
  disabled = false,
  onPress,
  primary = false,
  children,
}: NavButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onPress}
      className={cn(
        "inline-flex size-touch-xl items-center justify-center rounded-full border-3 border-kid-ink shadow-raised-4",
        primary ? "bg-kid-yellow" : "bg-white",
        "aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:shadow-none",
        FOCUS_RING,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Returns a check that is true once `delayMs` have passed since the component
 * mounted. Read it in event handlers, not while rendering.
 */
function useSettled(delayMs: number): () => boolean {
  const mountedAt = useRef<number | null>(null);
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);
  return () =>
    mountedAt.current !== null && Date.now() - mountedAt.current >= delayMs;
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}
