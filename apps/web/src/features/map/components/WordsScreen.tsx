import { LanguageIcon } from "@heroicons/react/24/solid";
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
import type { PracticeGameId } from "../model/progress";
import { type WordsData, wordCount } from "../model/words";
import { ChromeIcon } from "./ChromeIcon";
import { GAME_ART } from "./GamesArea";
import { MapBottomNav } from "./MapBottomNav";
import { PlaceWords } from "./PlaceWords";
import { ProgressErrorNotice } from "./ProgressErrorNotice";

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
        <div className="mx-auto flex w-full max-w-tab flex-col gap-6 px-4 pb-8 pt-safe-t sm:px-gutter">
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
          {/* The last place, the one reached most recently, starts open. */}
          {words?.places.map((place, index, places) => (
            <PlaceWords
              key={place.id}
              place={place}
              defaultOpen={index === places.length - 1}
            />
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

// The practice games: Memory and Spoji riječi in the chapter's games' icons,
// and Sastavi riječi, which only practice has (#294), in one row. Dealt from
// every learned word. Shown whenever there are words, even too few to deal a
// game: the game's page then says why.
// The chapter games' art, and Sastavi riječi's own.
const PRACTICE_ART = {
  ...GAME_ART,
  spell: { ActivityIcon: LanguageIcon, fill: "bg-kid-pink" },
} as const;

const PRACTICE: readonly { id: PracticeGameId; label: string }[] = [
  { id: "memory", label: "Memory" },
  { id: "match", label: "Spoji riječi" },
  { id: "spell", label: "Sastavi riječi" },
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
      <div className="grid grid-cols-3 gap-3">
        {PRACTICE.map(({ id, label }) => {
          const { ActivityIcon, fill } = PRACTICE_ART[id];
          return (
            <Link
              key={id}
              href={practicePath(id)}
              // Three in a row: the icon above its label, so "Spoji
              // riječi" fits a phone's third of the row.
              className={cn(
                BIG_BUTTON,
                "h-auto min-h-touch-xl flex-col gap-1 px-1 py-2 text-center text-lg leading-tight",
                fill,
              )}
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
