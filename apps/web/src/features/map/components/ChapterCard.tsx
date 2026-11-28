import { StarIcon } from "@heroicons/react/24/solid";
import Link from "next/link";

import { FOCUS_RING } from "@/components/ui/kid-styles";
import { WordImage } from "@/components/ui/WordImage";
import { TileBadge } from "@/components/ui/TileBadge";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import { type Chapter, CONTENT_LANG } from "../model/content";
import {
  type ChapterState,
  chapterSteps,
  type WithChapterState,
} from "../model/progress";

// How many of the chapter's first pictures the card shows.
const PREVIEW_COUNT = 3;

type ChapterCardProps = {
  chapter: WithChapterState<Chapter>;
  /** The chapter's screen. */
  href: string;
};

// A chapter on its place's screen, the whole card a link to the chapter: its
// first pictures, its title, how many words it has and how far the child got.
// The pictures are decorative, so the link is named by the text alone. A
// chapter is never locked, so the card always opens, also when progress has no
// state for it.
export function ChapterCard({ chapter, href }: ChapterCardProps) {
  const { title, words, chapterState } = chapter;
  return (
    <Link
      href={href}
      className={cn(
        fredoka.className,
        "flex w-full flex-col overflow-hidden rounded-kid-lg border-3 border-kid-ink bg-white text-kid-ink shadow-raised-4 hover:bg-kid-cream",
        FOCUS_RING,
      )}
    >
      <div
        aria-hidden="true"
        className="grid grid-cols-3 gap-2 border-b-3 border-kid-ink bg-kid-sea p-3"
      >
        {words
          .slice(0, PREVIEW_COUNT)
          .map(({ id, number, imageUrl, imageUrl512 }) => (
            <div
              key={id}
              className="aspect-square overflow-hidden rounded-kid bg-white"
            >
              {/* A third of a card at most half the column: the 512 px file. */}
              <WordImage
                src={imageUrl}
                src512={imageUrl512}
                sizes="10rem"
                placeholderId={`word-${number}`}
                withInitial={false}
                className="block size-full object-contain"
              />
            </div>
          ))}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2
          lang={CONTENT_LANG}
          className="break-words text-2xl font-semibold leading-tight"
        >
          {title}
        </h2>
        {/* Pauses for screen readers; the layout shows them. */}
        <span className="sr-only">, </span>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <span className="text-lg text-kid-muted">
            {words.length} {words.length === 1 ? "word" : "words"}
          </span>
          {chapterState !== null ? (
            <>
              <span className="sr-only">, </span>
              <ProgressBadge state={chapterState} />
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function ProgressBadge({ state }: { state: ChapterState }) {
  const { done, total } = chapterSteps(state);
  if (done === 0) {
    return <TileBadge state="available" label="Start here" />;
  }
  if (done === total) {
    return <TileBadge state="completed" label="All done" Icon={StarIcon} />;
  }
  return <TileBadge state="in-progress" label={`${done} of ${total} done`} />;
}
