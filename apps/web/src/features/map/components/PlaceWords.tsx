"use client";

import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { useId, useState } from "react";

import { FOCUS_RING } from "@/components/ui/kid-styles";
import { cn } from "@/lib/cn";

import { CONTENT_LANG } from "../model/content";
import { type WordPlace, wordCount } from "../model/words";
import { WordCard } from "./WordCard";

type PlaceWordsProps = {
  place: WordPlace;
  /** Whether its words show at first. */
  defaultOpen: boolean;
};

// One place on the Riječi tab: the green check, its name and "· N riječi" as
// a button that shows or hides its words (the disclosure pattern: a heading
// holding a button with aria-expanded), then its words, at most 10 to a line,
// fewer on a narrower screen. A region named by the place alone, so screen
// readers can jump between places.
export function PlaceWords({ place, defaultOpen }: PlaceWordsProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const nameId = useId();
  const wordsId = useId();
  return (
    <section aria-labelledby={nameId} className="flex flex-col gap-3">
      <h2 className="text-kid-ink">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={wordsId}
          onClick={() => setIsOpen((open) => !open)}
          className={cn(
            "flex min-h-touch w-full items-center gap-2 rounded-kid-lg border-3 border-kid-ink bg-white px-4 py-2 text-left shadow-raised-4",
            FOCUS_RING,
          )}
        >
          <CheckCircleIcon
            aria-hidden="true"
            className="size-8 shrink-0 text-kid-green"
          />
          <span id={nameId} lang={CONTENT_LANG} className="text-2xl font-bold">
            {place.name}
          </span>
          <span className="text-base font-semibold text-kid-muted">
            · {wordCount(place.words.length)}
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              "ml-auto size-7 shrink-0 transition-transform motion-reduce:transition-none",
              isOpen && "rotate-180",
            )}
          />
        </button>
      </h2>
      <ul
        id={wordsId}
        // The attribute for assistive tech, and the class too, since `grid`
        // would override the attribute's display: none.
        hidden={!isOpen}
        className={cn(
          "grid grid-cols-row-of-10 gap-3 [--row-gap:theme(spacing.3)] [--row-min:5.25rem]",
          !isOpen && "hidden",
        )}
      >
        {place.words.map((word) => (
          <li key={word.id} className="flex">
            <WordCard word={word} size="compact" />
          </li>
        ))}
      </ul>
    </section>
  );
}
