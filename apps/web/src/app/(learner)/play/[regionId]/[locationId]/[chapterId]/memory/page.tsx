import type { Metadata } from "next";

import {
  canDealMemoryGame,
  ChapterGame,
  GameUnavailable,
  gameUnavailableReason,
} from "@/features/games";
import { CONTENT_LANG } from "@/features/map/edge";
import { loadGameScreen } from "@/features/map/server";

type MemoryPageProps = {
  params: Promise<{ regionId: string; locationId: string; chapterId: string }>;
};

async function loadMemory({ params }: MemoryPageProps) {
  const { regionId, locationId, chapterId } = await params;
  return loadGameScreen(regionId, locationId, chapterId, "memory");
}

// Through the same gate as the page, over the same cached calls.
export async function generateMetadata(
  props: MemoryPageProps,
): Promise<Metadata> {
  const { chapter } = await loadMemory(props);
  return { title: `Memory: ${chapter.title}` };
}

// A chapter's memory game (ADR 0006). The gate renders the not-found page for
// an unknown place or chapter, or a game the chapter's state does not list,
// and sends a closed place back as the place's page does. Back returns to
// the chapter. Only the
// server opens a game: one it sent as `locked`, opened by URL, shows the lock
// message, and one it sent no state for says it did not load; neither shows
// the game. An open game whose chapter has too few pictures to deal says they
// are coming, rather than show an empty board. The h1 is for screen readers
// only while the game is on screen, so the board keeps the whole screen.
// Completing the game records it (#136).
export default async function MemoryPage(props: MemoryPageProps) {
  const { chapter, gameState, learnerName, placeHref, lessonHref } =
    await loadMemory(props);
  const heading = (
    <>
      Memory: <span lang={CONTENT_LANG}>{chapter.title}</span>
    </>
  );

  const words = chapter.words.map(({ id, text, imageUrl, imageUrl512 }) => ({
    id,
    text,
    imageUrl,
    imageUrl512,
  }));
  const unavailable = gameUnavailableReason(
    gameState,
    canDealMemoryGame(words),
  );

  if (unavailable !== null) {
    return (
      <GameUnavailable
        heading={heading}
        reason={unavailable}
        lessonHref={lessonHref}
        placeHref={placeHref}
      />
    );
  }

  return (
    <>
      <h1 className="sr-only">{heading}</h1>
      <ChapterGame
        key={chapter.id}
        gameId="memory"
        chapterId={chapter.id}
        words={words}
        placeHref={placeHref}
        learnerName={learnerName ?? undefined}
      />
    </>
  );
}
