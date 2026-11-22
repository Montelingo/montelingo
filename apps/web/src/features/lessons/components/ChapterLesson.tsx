"use client";

import { SaveNotice, useSaveResult } from "@/features/map";

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
// progress API. A failed save shows a retry on the "Bravo!" screen.
export function ChapterLesson({ chapterId, ...props }: ChapterLessonProps) {
  const { status, hasFailed, save, retry } = useSaveResult(
    { kind: "lesson", chapterId },
    props.placeHref,
  );
  return (
    <LessonCards
      {...props}
      onFinished={save}
      saveNotice={
        hasFailed ? <SaveNotice status={status} onRetry={retry} /> : null
      }
    />
  );
}
