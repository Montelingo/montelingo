"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/solid";
import { type ReactNode, useEffect, useReducer, useRef } from "react";
import { preload } from "react-dom";
import { useSwipeable } from "react-swipeable";

import { FOCUS_RING } from "@/components/ui/focus-ring";
import { PlaceholderArt } from "@/components/ui/PlaceholderArt";
import { CONTENT_LANG } from "@/features/map/edge";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import {
  cardIndex,
  cardPositionLabel,
  INITIAL_LESSON,
  isFirstCard,
  isLastCard,
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

// A chapter's lesson (ADR 0006): one large card, the picture alone or the word
// alone. A switch starts again from the first card (the second when the first
// is the word just shown), so a picture is never followed by its word. The
// copy is Montenegrin, so the lesson carries the content's language.
export function LessonCards({ words }: LessonCardsProps) {
  const count = words.length;
  // The reducer reads the current number of words, so it is never stale.
  const [state, dispatch] = useReducer(
    (current: LessonState, action: LessonAction) =>
      lessonReducer(current, action, count),
    INITIAL_LESSON,
  );
  const index = cardIndex(state, count);
  const word = words[index];
  const hasCard = word !== undefined;
  const next = () => dispatch({ type: "next" });
  const back = () => dispatch({ type: "back" });

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

  // The arrow keys turn the card wherever the focus is, while there is a
  // card: the lesson is the whole screen, and nothing on it takes arrow keys.
  useEffect(() => {
    if (!hasCard) {
      return;
    }
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
  }, [hasCard]);

  // Fetch the next picture while this one is on screen, so it is there at once.
  const upcoming = words[index + 1];
  if (state.mode === "pictures" && upcoming?.imageUrl) {
    preload(upcoming.imageUrl, { as: "image" });
  }

  if (!hasCard) {
    return null;
  }

  const atFirst = isFirstCard(state, count);
  const atLast = isLastCard(state, count);

  return (
    <div
      lang={CONTENT_LANG}
      className={cn(
        fredoka.className,
        "flex flex-1 flex-col gap-4 text-kid-ink",
      )}
    >
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

      <div className="flex items-center justify-between">
        <NavButton label="Nazad" disabled={atFirst} onPress={back}>
          <ArrowLeftIcon aria-hidden="true" className="size-9" />
        </NavButton>
        <NavButton label="Dalje" disabled={atLast} onPress={next} primary>
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

type NavButtonProps = {
  label: string;
  disabled: boolean;
  onPress: () => void;
  primary?: boolean;
  children: ReactNode;
};

// Next and Back: big round buttons. At the lesson's ends they stay focusable
// (aria-disabled), so the keyboard focus is not lost when one stops working.
function NavButton({
  label,
  disabled,
  onPress,
  primary = false,
  children,
}: NavButtonProps) {
  return (
    <button
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

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}
