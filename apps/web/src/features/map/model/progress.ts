import type { Schemas } from "@app/api-client";

import type { MapElementState, ServerMapState } from "./map-state";

type ProgressEntry = { readonly id: string; readonly state: ServerMapState };

/** A chapter's games, in the order the server lists them (ADR 0006). */
export type GameId = Schemas["GameState"]["id"];

/** A game's state. Only the server decides it: `locked` until the lesson is done. */
export type GameState = Schemas["GameState"]["state"];

/**
 * What a locked game says, on its card on the place's screen and on its own
 * screen when it is opened by URL: one string, so the two never disagree.
 */
export const LOCKED_GAME_MESSAGE = "First watch the lesson";

/**
 * A chapter's lesson and games, as the server decided them (ADR 0006). The
 * frontend never computes a lock: it draws these.
 */
export type ChapterState = {
  readonly id: string;
  /** `done` once the lesson has been seen to its last card. */
  readonly lesson: Schemas["ChapterState"]["lesson"];
  /** Always `memory`, then `match`. */
  readonly games: readonly { readonly id: GameId; readonly state: GameState }[];
};

/** What the child has collected, as the server counted it (#175, ADR 0005). */
export type ProgressCounts = {
  /** The words of every chapter whose lesson is `done`. */
  readonly wordsLearned: number;
  /** The places that are `completed`, one sticker each. */
  readonly stickers: number;
};

/**
 * The account's state for every region and location, and for the chapters of
 * every place that is not locked, as the server decided it, with its counts.
 */
export type Progress = {
  readonly regions: readonly ProgressEntry[];
  readonly locations: readonly ProgressEntry[];
  readonly chapters: readonly ChapterState[];
  readonly counts: ProgressCounts;
};

/**
 * What `getProgress()` resolves to. A failure is a value, not a throw, so the
 * content can still render, with every place in the error state. (A `401` is
 * thrown: signed out is not a failure to read progress.)
 */
export type ProgressResult =
  | { status: "ready"; progress: Progress }
  | { status: "error" };

/** A content item with the state to draw it in. */
export type WithState<Item> = Item & { state: MapElementState };

type Identified = { id: string };

export function toProgress(data: Schemas["ProgressState"]): Progress {
  return {
    regions: data.regions.map(({ id, state }) => ({ id, state })),
    locations: data.locations.map(({ id, state }) => ({ id, state })),
    chapters: data.chapters.map(({ id, lesson, games }) => ({
      id,
      lesson,
      games: games.map((game) => ({ id: game.id, state: game.state })),
    })),
    counts: {
      wordsLearned: data.counts.words_learned,
      stickers: data.counts.stickers,
    },
  };
}

/**
 * How much of a chapter is finished: its lesson and each of its games is one
 * step. Only counts what the server sent; it never decides a lock.
 */
export function chapterSteps({ lesson, games }: ChapterState): {
  done: number;
  total: number;
} {
  const playedGames = games.filter(({ state }) => state === "completed").length;
  return {
    done: (lesson === "done" ? 1 : 0) + playedGames,
    total: 1 + games.length,
  };
}

/** A chapter with its lesson and games' state, `null` when progress has none. */
export type WithChapterState<Chapter> = Chapter & {
  chapterState: ChapterState | null;
};

/**
 * Gives every chapter its state from progress, keeping content order. A
 * chapter progress has no entry for, or every chapter when progress failed,
 * gets `null`: its state is not known, and only the server decides it.
 */
export function joinChapterStates<Chapter extends Identified>(
  chapters: readonly Chapter[],
  progress: ProgressResult,
): WithChapterState<Chapter>[] {
  const entries = progress.status === "ready" ? progress.progress.chapters : [];
  const states = new Map(entries.map((state) => [state.id, state]));
  return chapters.map((chapter) => ({
    ...chapter,
    chapterState: states.get(chapter.id) ?? null,
  }));
}

/**
 * Gives every region and location its state from progress, keeping content
 * order. Content decides what is shown: a progress entry for an id that is not
 * in the content is ignored, and an item progress has no entry for is
 * `loading`, never `available`, because only the server opens a place
 * (ADR 0005). When progress failed, every item is `error`.
 */
export function joinProgress<
  Region extends Identified,
  Location extends Identified,
>(
  content: { regions: readonly Region[]; locations: readonly Location[] },
  progress: ProgressResult,
): { regions: WithState<Region>[]; locations: WithState<Location>[] } {
  const ready = progress.status === "ready" ? progress.progress : null;
  return {
    regions: attachStates(content.regions, ready?.regions),
    locations: attachStates(content.locations, ready?.locations),
  };
}

// Without entries (progress failed), every item is `error`.
function attachStates<Item extends Identified>(
  items: readonly Item[],
  entries: readonly ProgressEntry[] | undefined,
): WithState<Item>[] {
  if (entries === undefined) {
    return items.map((item) => ({ ...item, state: "error" }));
  }
  const states = new Map(entries.map(({ id, state }) => [id, state]));
  return items.map((item) => ({
    ...item,
    state: states.get(item.id) ?? "loading",
  }));
}

const NEXT_PLACE_STATES: ReadonlySet<MapElementState> = new Set([
  "available",
  "in-progress",
]);

/**
 * The place to go next: the first location, in content order, that is
 * `available` or `in-progress`. `null` when there is none, such as while
 * progress is loading or failed, or once everything is completed.
 */
export function pickNextPlace<Location extends { state: MapElementState }>(
  locations: readonly Location[],
): Location | null {
  return locations.find(({ state }) => NEXT_PLACE_STATES.has(state)) ?? null;
}
