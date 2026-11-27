"use client";

import { hasResultNotice, ResultNotice, useSaveResult } from "@/features/map";

import { LessonCards, type LessonCardsProps } from "./LessonCards";

export type ChapterLessonProps = Omit<
  LessonCardsProps,
  "onFinished" | "saveNotice"
> & {
  /** The chapter whose lesson this is: what reaching the last card records. */
  chapterId: string;
};

// A chapter's lesson that saves itself (#136, ADR 0006): reaching the last
// card records the lesson as seen, through the map feature, which owns the
// progress API. The "Bravo!" screen shows a heart when watching it again
// earned one (ADR 0009), and a failed save's retry.
export function ChapterLesson({ chapterId, ...props }: ChapterLessonProps) {
  const saved = useSaveResult({ kind: "lesson", chapterId }, props.placeHref);
  return (
    <LessonCards
      {...props}
      onFinished={saved.save}
      saveNotice={hasResultNotice(saved) ? <ResultNotice {...saved} /> : null}
    />
  );
}
