import { CheckCircleIcon } from "@heroicons/react/24/solid";
import Image from "next/image";
import Link from "next/link";
import { useId } from "react";

import { BIG_BUTTON } from "@/components/ui/kid-styles";
import { PLAY_PATH } from "@/features/auth/edge";
import { type Avatar, avatarSrc } from "@/features/profile/edge";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import { CONTENT_LANG } from "../model/content";
import { practicePath } from "../model/paths";
import type { GameId } from "../model/progress";
import { type WordPlace, type WordsData, wordCount } from "../model/words";
import { ChromeIcon } from "./ChromeIcon";
import { GAME_ART } from "./GamesArea";
import { MapBottomNav } from "./MapBottomNav";
import { ProgressErrorNotice } from "./ProgressErrorNotice";
import { WordCard } from "./WordCard";

// The Riječi tab, /play/words (#234, screen 1 of #237): "Moje riječi" and the
// word count, the Vježbaj card (#235), then each place where the child saw a
// lesson, with its words, and the next place, where more words wait. Before
// any lesson, the empty state points to the map. Laid out like the Ja tab: a centred column from tablet
// width, the full width less a 16px gutter on a phone, scrolling above the
// bottom nav. `data-map-screen` drops LearnerShell's Back and Home bar.
export function WordsScreen({ words, avatar, needsRetry }: WordsData) {
  return (
    <div
      data-map-screen
      className={cn(
        fredoka.className,
        "fixed inset-0 flex flex-col bg-kid-cream",
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pb-8 pt-safe-t sm:px-gutter">
          <header className="flex items-center justify-between gap-4 pt-6">
            <h1 className="text-4xl font-bold leading-tight text-kid-ink">
              Moje riječi
            </h1>
            {/* Unknown (words failed) shows no badge, never a wrong 0. */}
            {words !== null ? (
              <div
                role="group"
                aria-label={`Riječi: ${words.total}`}
                className="flex shrink-0 items-center gap-2 rounded-badge border-3 border-kid-ink bg-white px-4 py-1.5 shadow-raised-4"
              >
                <ChromeIcon name="words" size={26} />
                <span
                  aria-hidden="true"
                  className="text-2xl font-bold text-kid-ink"
                >
                  {words.total}
                </span>
              </div>
            ) : null}
          </header>
          {needsRetry ? (
            <ProgressErrorNotice message="Your words didn’t load. Something went wrong on our side. Let’s try again." />
          ) : null}
          {words !== null && words.places.length === 0 ? (
            <NoWords avatar={avatar} />
          ) : null}
          {words !== null && words.places.length > 0 ? <Practice /> : null}
          {words?.places.map((place) => (
            <PlaceWords key={place.id} place={place} />
          ))}
          {words !== null &&
          words.places.length > 0 &&
          words.nextPlace !== null ? (
            <p className="flex items-center gap-3 rounded-kid-lg border-3 border-dashed border-kid-line bg-kid-fog px-5 py-4 text-lg font-semibold text-kid-muted">
              <ChromeIcon name="lock" size={24} />
              {/* Montenegrin, read as one. The name stays as the API sends it (the
                  nominative), so the copy must not put it after a verb. */}
              <span lang={CONTENT_LANG}>
                {`Sljedeće mjesto: ${words.nextPlace.name} · još ${wordCount(words.nextPlace.wordCount)}`}
              </span>
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col lg:items-center lg:pb-5">
        <MapBottomNav current="words" />
      </div>
    </div>
  );
}

// The practice games' Memory and Spoji riječi, in the chapter's games' icons,
// dealt from every learned word. Shown whenever there are words, even too few
// to deal a game: the game's page then says why.
const PRACTICE: readonly { id: GameId; label: string }[] = [
  { id: "memory", label: "Memory" },
  { id: "match", label: "Spoji riječi" },
];

function Practice() {
  const titleId = useId();
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-kid-lg border-3 border-kid-ink bg-white p-4 shadow-raised-4"
    >
      <h2 id={titleId} className="text-2xl font-bold text-kid-ink">
        Vježbaj
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {PRACTICE.map(({ id, label }) => {
          const { ActivityIcon, fill } = GAME_ART[id];
          return (
            <Link
              key={id}
              href={practicePath(id)}
              className={cn(BIG_BUTTON, "gap-2 px-3 text-xl", fill)}
            >
              <ActivityIcon aria-hidden="true" className="size-7 shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// One place: the green check, its name and "· N riječi", then its words,
// in a row on a phone and up to six on a tablet. A region named by the place
// alone, so screen readers can jump between places.
function PlaceWords({ place }: { place: WordPlace }) {
  const nameId = useId();
  return (
    <section aria-labelledby={nameId} className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-kid-ink">
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
      </h2>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-3">
        {place.words.map((word) => (
          <li key={word.id} className="flex">
            <WordCard word={word} size="compact" />
          </li>
        ))}
      </ul>
    </section>
  );
}

// Before the first lesson: the child's buddy, what the tab is for, and the
// way to the map, where the lessons are.
function NoWords({ avatar }: { avatar: Avatar }) {
  return (
    <div className="flex flex-col items-center gap-3 pt-6 text-center">
      <div className="mb-2 rounded-full border-3 border-kid-ink bg-kid-yellow p-2 shadow-raised-6">
        <Image
          src={avatarSrc(avatar)}
          alt=""
          aria-hidden="true"
          width={104}
          height={104}
          // Local SVGs need no resizing (see ChromeIcon).
          unoptimized
          className="block"
        />
      </div>
      <h2 className="text-3xl font-bold leading-tight text-kid-ink">
        Još nemaš riječi
      </h2>
      <p className="text-lg font-medium text-kid-muted">
        Pogledaj prvu lekciju i riječi će stići ovdje.
      </p>
      <Link
        href={PLAY_PATH}
        className={cn(BIG_BUTTON, "mt-3 max-w-xs bg-kid-yellow")}
      >
        Na mapu
      </Link>
    </div>
  );
}
