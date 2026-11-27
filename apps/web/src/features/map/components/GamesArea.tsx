import {
  BookOpenIcon,
  PuzzlePieceIcon,
  Squares2X2Icon,
  StarIcon,
} from "@heroicons/react/24/solid";
import { type ComponentProps, useId } from "react";

import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import type { Chapter, LocationDetail } from "../model/content";
import { gamePath, lessonPath } from "../model/paths";
import {
  type ChapterState,
  type GameId,
  type GameState,
  LOCKED_GAME_MESSAGE,
  type WithChapterState,
} from "../model/progress";
import { ActivityCard } from "./ActivityCard";

/**
 * What a chapter's games area is given. Plain data, so the area may become a
 * Client Component.
 */
export type GamesAreaProps = {
  /** The chapter's place. */
  location: Pick<LocationDetail, "id" | "regionId">;
  /** The chapter, with its lesson and games' state from `GET /progress`. */
  chapter: WithChapterState<Chapter>;
};

type CardProps = ComponentProps<typeof ActivityCard>;
type Activity = Pick<CardProps, "title" | "ActivityIcon" | "fill">;
type StateLook = Pick<CardProps, "state" | "label" | "Icon">;

const LESSON: Activity = {
  title: "Lesson",
  ActivityIcon: BookOpenIcon,
  fill: "bg-kid-yellow",
};

/** Each game's icon and fill, on a chapter's card and on Riječi's Vježbaj. */
export const GAME_ART: Record<
  GameId,
  Pick<Activity, "ActivityIcon" | "fill">
> = {
  memory: { ActivityIcon: Squares2X2Icon, fill: "bg-kid-sea" },
  match: { ActivityIcon: PuzzlePieceIcon, fill: "bg-kid-land" },
};

const GAMES: Record<GameId, Activity> = {
  memory: { title: "Memory", ...GAME_ART.memory },
  match: { title: "Match", ...GAME_ART.match },
};

// A game in the server's state. Each game state is drawn as the tile state of
// the same name.
const GAME_STATES: Record<GameState, StateLook> = {
  locked: { state: "locked", label: LOCKED_GAME_MESSAGE },
  available: { state: "available", label: "Ready to play" },
  completed: { state: "completed", label: "Completed", Icon: StarIcon },
};

const LESSON_STATES: Record<ChapterState["lesson"], StateLook> = {
  todo: { state: "available", label: "Start here" },
  done: { state: "completed", label: "Done" },
};

// The lesson when progress has no state for its chapter: it is never locked,
// so it still opens, without claiming it is seen or not.
const LESSON_STATE_UNKNOWN: StateLook = { state: "available", label: "Watch" };

// A chapter's lesson and games, a labelled region above its words: a card
// each, in the state the server sent. The lesson's card always links to the
// lesson, which is never locked, and a game's to the game once the server has
// opened it (`available` or `completed`); a locked game's card is plain text.
// The frontend never decides a lock (ADR 0006): for a chapter the server sent
// no state for, the lesson still opens, and the area says its games did not
// load, with nothing that looks locked or open.
export function GamesArea({ location, chapter }: GamesAreaProps) {
  const titleId = useId();
  const { chapterState } = chapter;
  const ids = [location.regionId, location.id, chapter.id] as const;
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2
        id={titleId}
        className={cn(fredoka.className, "text-2xl font-semibold text-kid-ink")}
      >
        Games
      </h2>
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops list semantics from a <ul> whose list-style is none (Tailwind's preflight), so the role is restated */}
      <ul
        role="list"
        aria-label={`${chapter.title} lesson and games`}
        className="grid gap-4 sm:grid-cols-3"
      >
        <li className="flex min-w-0">
          <ActivityCard
            {...LESSON}
            {...(chapterState === null
              ? LESSON_STATE_UNKNOWN
              : LESSON_STATES[chapterState.lesson])}
            href={lessonPath(...ids)}
          />
        </li>
        {chapterState?.games.map(({ id, state }) => (
          <li key={id} className="flex min-w-0">
            <ActivityCard
              {...GAMES[id]}
              {...GAME_STATES[state]}
              href={state === "locked" ? null : gamePath(...ids, id)}
            />
          </li>
        ))}
      </ul>
      {chapterState === null ? (
        <p className="text-lg text-kid-ink">Its games did not load.</p>
      ) : null}
    </section>
  );
}
