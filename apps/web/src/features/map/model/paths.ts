import { PLAY_PATH } from "@/features/auth/edge";

import type { GameId } from "./progress";

// The map's URLs: /play, then /play/<region>, then /play/<region>/<location>,
// a chapter's lesson and games under it, /play/<region>/<location>/<chapter>/
// lesson or /<game>, and the Prizes tab, /play/prizes (no region is called
// "prizes"). Ids are content slugs, encoded anyway so an id can never add a
// path segment.

/** The screen listing a region's locations. */
export function regionPath(regionId: string): string {
  return `${PLAY_PATH}/${encodeURIComponent(regionId)}`;
}

/** A location's screen, under its region. */
export function locationPath(regionId: string, locationId: string): string {
  return `${regionPath(regionId)}/${encodeURIComponent(locationId)}`;
}

/** The Prizes tab's screen: a sticker per place, by region. */
export const PRIZES_PATH = `${PLAY_PATH}/prizes`;

/**
 * A chapter, under its place. It has no screen of its own: it sends the
 * learner to the place, so Back from a lesson or game, which goes up the URL,
 * lands there.
 */
export function chapterPath(
  regionId: string,
  locationId: string,
  chapterId: string,
): string {
  return `${locationPath(regionId, locationId)}/${encodeURIComponent(chapterId)}`;
}

/** A chapter's lesson. */
export function lessonPath(
  regionId: string,
  locationId: string,
  chapterId: string,
): string {
  return `${chapterPath(regionId, locationId, chapterId)}/lesson`;
}

/**
 * The games that have a screen. `match` gets its route with its game (#137);
 * until then its card on the place's screen links nowhere.
 */
const GAMES_WITH_A_SCREEN: ReadonlySet<GameId> = new Set<GameId>(["memory"]);

/** A chapter's game, or `null` for a game that has no screen yet. */
export function gamePath(
  regionId: string,
  locationId: string,
  chapterId: string,
  gameId: GameId,
): string | null {
  return GAMES_WITH_A_SCREEN.has(gameId)
    ? `${chapterPath(regionId, locationId, chapterId)}/${gameId}`
    : null;
}
