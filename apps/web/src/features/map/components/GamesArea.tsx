import { ClockIcon, StarIcon } from "@heroicons/react/24/solid";
import { type ComponentProps, useId } from "react";

import {
  type Chapter,
  CONTENT_LANG,
  type LocationDetail,
} from "../model/content";
import {
  type ChapterState,
  type GameId,
  type GameState,
  LOCKED_GAME_MESSAGE,
  type WithChapterState,
} from "../model/progress";
import { gamePath, hasScreen, lessonPath } from "../model/paths";
import { ChapterPill } from "./ChapterPill";

/**
 * What a place's games area is given. Plain data, so the area may become a
 * Client Component.
 */
export type GamesAreaProps = {
  /** The place the games are for. */
  location: Pick<LocationDetail, "id" | "name" | "regionId">;
  /**
   * The place's chapters, with their words, in recording order, each with its
   * lesson and games' state from `GET /progress`.
   */
  chapters: readonly WithChapterState<Chapter>[];
};

type PillLook = Omit<ComponentProps<typeof ChapterPill>, "title">;

const GAME_NAMES: Record<GameId, string> = {
  memory: "Memory",
  match: "Match",
};

// A game in the server's state. Each game state is drawn as the tile state of
// the same name.
const GAME_PILLS: Record<GameState, PillLook> = {
  locked: { state: "locked", label: LOCKED_GAME_MESSAGE },
  available: { state: "available", label: "Ready to play" },
  completed: { state: "completed", label: "Completed", Icon: StarIcon },
};

// A game that has no screen yet, whatever its state: nothing to open, so it
// never looks open.
const COMING_SOON_PILL: PillLook = {
  state: "locked",
  label: "Coming soon",
  Icon: ClockIcon,
};

const LESSON_PILLS: Record<ChapterState["lesson"], PillLook> = {
  todo: { state: "available", label: "Start here" },
  done: { state: "completed", label: "Done" },
};

// The lesson when progress has no state for its chapter: it is never locked,
// so it still opens, without claiming it is seen or not.
const LESSON_STATE_UNKNOWN_PILL: PillLook = {
  state: "available",
  label: "Watch",
};

// The one place on a place's screen where its lessons and games go, marked as
// a labelled region, above the word groups. Each chapter, in recording order,
// is one row: its title, then its lesson and a pill per game, each in the
// state the server sent. Pills are one line high, so a place's chapters still
// leave its first words on screen. The lesson's pill always links to the
// lesson, which is never locked, and a game's to the game once the server has
// opened it (`available` or `completed`); a locked game's pill is plain text,
// and so is one with no screen yet, which says it is coming. The frontend
// never decides a lock (ADR 0006): for a chapter the server sent no state for,
// the lesson still opens, and the row says its games did not load, with
// nothing that looks locked or open. Chapter titles are Montenegrin, so they
// carry the content's `lang`.
export function GamesArea({ location, chapters }: GamesAreaProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-tile bg-surface-muted p-4"
    >
      <h2 id={titleId} className="text-xl font-bold text-ink">
        Games
      </h2>
      {chapters.map((chapter) => (
        <ChapterRow key={chapter.id} location={location} chapter={chapter} />
      ))}
    </section>
  );
}

// One chapter's lesson and games. The chapter's word group below is named by
// the same title, so the list's name adds "lesson and games".
function ChapterRow({
  location,
  chapter,
}: {
  location: GamesAreaProps["location"];
  chapter: WithChapterState<Chapter>;
}) {
  const { chapterState } = chapter;
  const [regionId, locationId, chapterId] = [
    location.regionId,
    location.id,
    chapter.id,
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h3 lang={CONTENT_LANG} className="text-lg font-semibold text-ink">
        {chapter.title}
      </h3>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a <ul> whose list-style is none (Tailwind's preflight), so the role is restated */}
      <ul
        role="list"
        aria-label={`${chapter.title} lesson and games`}
        className="flex flex-wrap gap-2"
      >
        <li>
          <ChapterPill
            title="Lesson"
            {...(chapterState === null
              ? LESSON_STATE_UNKNOWN_PILL
              : LESSON_PILLS[chapterState.lesson])}
            href={lessonPath(regionId, locationId, chapterId)}
          />
        </li>
        {chapterState?.games.map(({ id, state }) => (
          <li key={id}>
            {hasScreen(id) ? (
              <ChapterPill
                title={GAME_NAMES[id]}
                {...GAME_PILLS[state]}
                href={
                  state === "locked"
                    ? null
                    : gamePath(regionId, locationId, chapterId, id)
                }
              />
            ) : (
              <ChapterPill title={GAME_NAMES[id]} {...COMING_SOON_PILL} />
            )}
          </li>
        ))}
      </ul>
      {chapterState === null ? (
        <p className="text-lg text-ink">Its games did not load.</p>
      ) : null}
    </div>
  );
}
