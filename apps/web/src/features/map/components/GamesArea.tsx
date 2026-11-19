import { StarIcon } from "@heroicons/react/24/solid";
import { type ComponentProps, useId } from "react";

import {
  type Chapter,
  CONTENT_LANG,
  type LocationDetail,
} from "../model/content";
import type {
  ChapterState,
  GameId,
  GameState,
  WithChapterState,
} from "../model/progress";
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
  locked: { state: "locked", label: "First watch the lesson" },
  available: { state: "available", label: "Ready to play" },
  completed: { state: "completed", label: "Completed", Icon: StarIcon },
};

const LESSON_PILLS: Record<ChapterState["lesson"], PillLook> = {
  todo: { state: "available", label: "Start here" },
  done: { state: "completed", label: "Done" },
};

// The one place on a place's screen where its lessons and games go, marked as
// a labelled region, above the word groups. Each chapter, in recording order,
// is one row: its title, then its lesson and a pill per game, each in the
// state the server sent. Pills are one line high, so a place's chapters still
// leave its first words on screen. The frontend never decides a lock
// (ADR 0006): a chapter the server sent no state for says so, with nothing
// that looks locked or open. Chapter titles are Montenegrin, so they carry
// the content's `lang`.
export function GamesArea({ chapters }: GamesAreaProps) {
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
        <ChapterRow key={chapter.id} chapter={chapter} />
      ))}
    </section>
  );
}

// One chapter's lesson and games. The chapter's word group below is named by
// the same title, so the list's name adds "lesson and games".
function ChapterRow({ chapter }: { chapter: WithChapterState<Chapter> }) {
  const { chapterState } = chapter;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h3 lang={CONTENT_LANG} className="text-lg font-semibold text-ink">
        {chapter.title}
      </h3>
      {chapterState === null ? (
        <p className="text-lg text-ink">
          This chapter&apos;s lesson and games did not load.
        </p>
      ) : (
        // eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a <ul> whose list-style is none (Tailwind's preflight), so the role is restated
        <ul
          role="list"
          aria-label={`${chapter.title} lesson and games`}
          className="flex flex-wrap gap-2"
        >
          <li>
            <ChapterPill
              title="Lesson"
              {...LESSON_PILLS[chapterState.lesson]}
            />
          </li>
          {chapterState.games.map(({ id, state }) => (
            <li key={id}>
              <ChapterPill title={GAME_NAMES[id]} {...GAME_PILLS[state]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
