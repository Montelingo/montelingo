import { redirect } from "next/navigation";

import { chapterPath } from "@/features/map";
import { assertChapterOpen } from "@/features/map/server";

type ChapterPageProps = {
  params: Promise<{ regionId: string; locationId: string; chapterId: string }>;
};

// A chapter has no screen of its own: its lesson and games are on its place's
// screen. Its URL leads there, so Back from a lesson or a game, which goes up
// the URL, returns to the place. It goes through the same gate first, so an
// unknown chapter is the not-found page and a closed place redirects as the
// place's own page does.
export default async function ChapterPage({ params }: ChapterPageProps) {
  const { regionId, locationId, chapterId } = await params;
  const { placeHref } = await assertChapterOpen(
    regionId,
    locationId,
    chapterId,
    chapterPath(regionId, locationId, chapterId),
  );
  redirect(placeHref);
}
