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

// A chapter's lesson and games are under the chapter, but the chapter itself
// has no screen: its lesson and games are on its place's screen.
function chapterPath(
  regionId: string,
  locationId: string,
  chapterId: string,
): string {
  return `${locationPath(regionId, locationId)}/${encodeURIComponent(chapterId)}`;
}

/**
 * Depths below /play whose URLs have no screen: a chapter's (3), between its
 * place (2) and its lesson or game (4). The learner area's Back skips them, so
 * Back from a lesson or a game returns to the place.
 */
export const SCREENLESS_PLAY_DEPTHS: readonly number[] = [3];

/** A chapter's lesson. */
export function lessonPath(
  regionId: string,
  locationId: string,
  chapterId: string,
): string {
  return `${chapterPath(regionId, locationId, chapterId)}/lesson`;
}

/**
 * A chapter's game. Each game's screen is at app/(learner)/play/[regionId]/
 * [locationId]/[chapterId]/<game>/page.tsx; a test checks every game has one.
 */
export function gamePath(
  regionId: string,
  locationId: string,
  chapterId: string,
  gameId: GameId,
): string {
  return `${chapterPath(regionId, locationId, chapterId)}/${gameId}`;
}
