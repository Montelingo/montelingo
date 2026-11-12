import { useId } from "react";

import { CardGrid } from "@/components/ui/CardGrid";

import { type Chapter, CONTENT_LANG } from "../model/content";
import { WordCard } from "./WordCard";

type WordGroupProps = {
  chapter: Chapter;
};

// One chapter of a place: its title, then its words as cards in the `words`
// grid, the list named by the title. Not a landmark: a place has up to four,
// and its headings already lead from one to the next.
export function WordGroup({ chapter }: WordGroupProps) {
  const titleId = useId();
  return (
    <div className="flex flex-col gap-3">
      <h2
        id={titleId}
        lang={CONTENT_LANG}
        className="text-2xl font-bold text-ink"
      >
        {chapter.title}
      </h2>
      <CardGrid labelledBy={titleId} columns="words">
        {chapter.words.map((word) => (
          <WordCard key={word.id} word={word} />
        ))}
      </CardGrid>
    </div>
  );
}
