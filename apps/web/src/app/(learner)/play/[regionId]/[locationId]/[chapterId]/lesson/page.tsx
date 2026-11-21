import type { Metadata } from "next";

import { LessonCards } from "@/features/lessons";
import { lessonPath } from "@/features/map";
import { CONTENT_LANG } from "@/features/map/edge";
import { assertChapterOpen } from "@/features/map/server";

type LessonPageProps = {
  params: Promise<{ regionId: string; locationId: string; chapterId: string }>;
};

async function loadLesson({ params }: LessonPageProps) {
  const { regionId, locationId, chapterId } = await params;
  return assertChapterOpen(
    regionId,
    locationId,
    chapterId,
    lessonPath(regionId, locationId, chapterId),
  );
}

// Through the same gate as the page, over the same cached calls.
export async function generateMetadata(
  props: LessonPageProps,
): Promise<Metadata> {
  const { chapter } = await loadLesson(props);
  return { title: `Lesson: ${chapter.title}` };
}

// A chapter's lesson (ADR 0006). The gate renders the not-found page for an
// unknown place or chapter, and sends a closed place back as the place's page
// does; the lesson itself is never locked. The page's h1 is for screen
// readers only, so the lesson keeps the whole screen; the lesson's "Bravo!"
// is its h2.
export default async function LessonPage(props: LessonPageProps) {
  const { chapter, placeHref } = await loadLesson(props);
  return (
    <>
      <h1 className="sr-only">
        Lesson: <span lang={CONTENT_LANG}>{chapter.title}</span>
      </h1>
      <LessonCards
        key={chapter.id}
        words={chapter.words.map(({ id, number, text, imageUrl }) => ({
          id,
          number,
          text,
          imageUrl,
        }))}
        placeHref={placeHref}
      />
    </>
  );
}
