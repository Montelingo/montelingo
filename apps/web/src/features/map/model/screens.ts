import { PLAY_PATH } from "@/features/auth/edge";

import type { Chapter, LocationDetail, RegionDetail } from "./content";
import {
  isOpenState,
  type MapLocationLink,
  type MapElementState,
} from "./map-state";
import { withMapNotice } from "./notices";
import { lessonPath, locationPath, regionPath } from "./paths";
import {
  type GameId,
  type GameState,
  joinChapterStates,
  joinProgress,
  pickNextPlace,
  type ProgressResult,
  type WithChapterState,
  type WithState,
} from "./progress";

// What the map and region screens show, built from content and progress. The
// server decides every lock (ADR 0005); these only read the states.

type RegionWithState = WithState<Pick<RegionDetail, "id" | "name">>;

/** The region screen: the region itself and its locations, in content order. */
export type RegionScreenData = {
  region: RegionWithState;
  locations: MapLocationLink[];
};

/** A location with its chapters, each with its lesson and games' state. */
export type LocationWithChapterStates = Omit<LocationDetail, "chapters"> & {
  chapters: readonly WithChapterState<Chapter>[];
};

/** A location's screen: the location with its chapters, and its region. */
export type LocationScreenData = {
  region: RegionWithState;
  location: WithState<LocationWithChapterStates>;
};

/**
 * A chapter's lesson or game screen: the chapter, with its words and its
 * lesson and games' state, and its place.
 */
export type ChapterScreenData = {
  /** The chapter's place. */
  location: Pick<LocationDetail, "id" | "name" | "regionId">;
  chapter: WithChapterState<Chapter>;
  /** The place's screen, where the lesson and games lead back to. */
  placeHref: string;
  /** The chapter's lesson, where a locked game sends the learner. */
  lessonHref: string;
};

/**
 * A chapter's game screen: the chapter, the game's state as the server sent
 * it (`null` when it sent none), and the child's name, for "Bravo, Mia!".
 */
export type GameScreenData = ChapterScreenData & {
  gameState: GameState | null;
  learnerName: string | null;
};

/**
 * One chapter of an open place's screen, or `null` when the place has no
 * chapter `chapterId`.
 */
export function toChapterScreen(
  { location }: LocationScreenData,
  chapterId: string,
): ChapterScreenData | null {
  const chapter = location.chapters.find(({ id }) => id === chapterId);
  if (chapter === undefined) {
    return null;
  }
  return {
    location: {
      id: location.id,
      name: location.name,
      regionId: location.regionId,
    },
    chapter,
    placeHref: locationPath(location.regionId, location.id),
    lessonHref: lessonPath(location.regionId, location.id, chapter.id),
  };
}

/**
 * A game's state in a chapter, as the server sent it: `{ state }`, where
 * `state` is `null` when progress has no state for the chapter (only the
 * server decides a lock, ADR 0006, so it is never read as open or locked); or
 * `null` when the chapter's state does not list the game, which is then not
 * one of the chapter's games.
 */
export function gameStateOf(
  chapter: WithChapterState<Chapter>,
  gameId: GameId,
): { state: GameState | null } | null {
  const { chapterState } = chapter;
  if (chapterState === null) {
    return { state: null };
  }
  const game = chapterState.games.find(({ id }) => id === gameId);
  return game === undefined ? null : { state: game.state };
}

/** A region and its locations, each with its state, the next place marked. */
export function toRegionScreen(
  region: RegionDetail,
  progress: ProgressResult,
): RegionScreenData {
  const joined = joinProgress(
    { regions: [region], locations: region.locations },
    progress,
  );
  const nextPlace = pickNextPlace(joined.locations);
  return {
    region: regionWithState(region, joined.regions),
    locations: joined.locations.map(({ id, name, state }) => ({
      id,
      name,
      state,
      href: locationPath(region.id, id),
      isNext: id === nextPlace?.id,
    })),
  };
}

/** A location and its region, each with its state, and its chapters' states. */
export function toLocationScreen(
  region: RegionDetail,
  location: LocationDetail,
  progress: ProgressResult,
): LocationScreenData {
  const joined = joinProgress(
    { regions: [region], locations: [location] },
    progress,
  );
  return {
    region: regionWithState(region, joined.regions),
    location: {
      ...location,
      state: stateOf(joined.locations, location.id),
      chapters: joinChapterStates(location.chapters, progress),
    },
  };
}

// The region alone, without its locations, in its state from `joined`.
function regionWithState(
  { id, name }: RegionDetail,
  joined: readonly { id: string; state: MapElementState }[],
): RegionWithState {
  return { id, name, state: stateOf(joined, id) };
}

// joinProgress() keeps every item, so the id is always there; `loading`, its
// state for an item progress does not cover, keeps the type honest anyway.
function stateOf(
  items: readonly { id: string; state: MapElementState }[],
  id: string,
): MapElementState {
  return items.find((item) => item.id === id)?.state ?? "loading";
}

// Where a learner goes from a region that is not open: the map, which says why.
const REGION_LOCKED_PATH = withMapNotice(PLAY_PATH, "region-locked");

/**
 * Where a region screen sends the learner instead, or `null` to stay. Only
 * `locked` leaves: while the state is `loading` or `error` the screen still
 * renders, since its places reveal nothing, and offers a retry.
 */
export function lockedRegionRedirect(
  regionState: MapElementState,
): string | null {
  return regionState === "locked" ? REGION_LOCKED_PATH : null;
}

/**
 * Where a location screen sends the learner instead, or `null` to stay. Unlike
 * the region screen, which reveals nothing, a location shows its words, so it
 * stays only when the location and its region are both open. A locked region
 * goes to the map, and a locked location to its region, each with a notice
 * that says why. A state that is not known (`loading` or `error`: progress
 * failed, or has no entry) goes to the region without one: its screen already
 * says progress did not load, and offers a retry.
 */
export function closedLocationRedirect(
  regionId: string,
  regionState: MapElementState,
  locationState: MapElementState,
): string | null {
  if (regionState === "locked") {
    return REGION_LOCKED_PATH;
  }
  if (locationState === "locked") {
    return withMapNotice(regionPath(regionId), "location-locked");
  }
  if (!isOpenState(regionState) || !isOpenState(locationState)) {
    return regionPath(regionId);
  }
  return null;
}

/**
 * True when the server has not given a state for any of `items`: progress
 * failed (`error`) or has no entry for it (`loading`). Either way reading
 * progress again may fix it, so the screen offers a retry.
 */
export function needsProgressRetry(
  items: readonly { state: MapElementState }[],
): boolean {
  return items.some(({ state }) => state === "error" || state === "loading");
}
