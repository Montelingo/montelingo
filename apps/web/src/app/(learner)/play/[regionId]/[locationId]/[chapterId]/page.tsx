import type { Metadata } from "next";

import { ChapterScreen } from "@/features/map";
import { loadChapterScreen } from "@/features/map/server";

type ChapterPageProps = {
  params: Promise<{ regionId: string; locationId: string; chapterId: string }>;
};

async function loadChapter({ params }: ChapterPageProps) {
  const { regionId, locationId, chapterId } = await params;
  return loadChapterScreen(regionId, locationId, chapterId);
}

// Through the same gate as the page, over the same cached calls.
export async function generateMetadata(
  props: ChapterPageProps,
): Promise<Metadata> {
  const { chapter } = await loadChapter(props);
  return { title: chapter.title };
}

// A chapter: its lesson, games and words. The gate renders the not-found page
// for an unknown place or chapter, and sends a closed place back as the
// place's page does.
export default async function ChapterPage(props: ChapterPageProps) {
  return <ChapterScreen {...await loadChapter(props)} />;
}
