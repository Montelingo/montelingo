import { PLAY_PATH } from "@/features/auth";

// The map's URLs: /play, then /play/<region>, then /play/<region>/<location>.
// Ids are content slugs, encoded anyway so an id can never add a path segment.

/** The screen listing a region's locations. */
export function regionPath(regionId: string): string {
  return `${PLAY_PATH}/${encodeURIComponent(regionId)}`;
}

/** A location's screen, under its region. */
export function locationPath(regionId: string, locationId: string): string {
  return `${regionPath(regionId)}/${encodeURIComponent(locationId)}`;
}
