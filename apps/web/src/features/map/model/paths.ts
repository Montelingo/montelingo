import { PLAY_PATH } from "@/features/auth/edge";

// The map's URLs: /play, then /play/<region>, then /play/<region>/<location>,
// and the Prizes tab, /play/prizes (no region is called "prizes").
// Ids are content slugs, encoded anyway so an id can never add a path segment.

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
