import { useId } from "react";

import { CardGrid } from "@/components/ui/CardGrid";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import type { ChapterScreenData } from "../model/screens";
import { GamesArea } from "./GamesArea";
import { ScreenHeader } from "./ScreenHeader";
import { WordCard } from "./WordCard";

// A chapter, /play/<region>/<location>/<chapter>: a section named by its
// title, the place it is in (a link back to it), its lesson and games, then
// its words in recording order. Only an open place's chapter gets here: the
// page's loader, loadChapterScreen(), sends every other one away first.
export function ChapterScreen({
  location,
  chapter,
  placeHref,
}: ChapterScreenData) {
  const titleId = useId();
  const wordsId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-6">
      <ScreenHeader
        titleId={titleId}
        title={chapter.title}
        parent={{ name: location.name, href: placeHref }}
      />
      <GamesArea location={location} chapter={chapter} />
      <div className="flex flex-col gap-3">
        <h2
          id={wordsId}
          className={cn(
            fredoka.className,
            "text-2xl font-semibold text-kid-ink",
          )}
        >
          Words
        </h2>
        <CardGrid labelledBy={wordsId} columns="words">
          {chapter.words.map((word) => (
            <WordCard key={word.id} word={word} />
          ))}
        </CardGrid>
      </div>
    </section>
  );
}
