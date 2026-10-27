import { PLAY_PATH } from "@/features/auth/edge";

import type { LocationDetail, Region, RegionDetail } from "./content";
import {
  isOpenState,
  type LocationPickerLocation,
  type MapElementState,
  type RegionPickerRegion,
} from "./map-state";
import { withMapNotice } from "./notices";
import { locationPath, regionPath } from "./paths";
import {
  joinProgress,
  pickNextPlace,
  type ProgressResult,
  type WithState,
} from "./progress";

// What the map and region screens show, built from content and progress. The
// server decides every lock (ADR 0005); these only read the states.

type RegionWithState = WithState<Pick<RegionDetail, "id" | "name">>;

/** The region screen: the region itself and its locations, in content order. */
export type RegionScreenData = {
  region: RegionWithState;
  locations: LocationPickerLocation[];
};

/** A location's screen: the location with its chapters, and its region. */
export type LocationScreenData = {
  region: RegionWithState;
  location: WithState<LocationDetail>;
};

/** Every region as a card on the map, in content order. */
export function toRegionPickerRegions(
  regions: readonly Region[],
  progress: ProgressResult,
): RegionPickerRegion[] {
  return joinProgress({ regions, locations: [] }, progress).regions.map(
    ({ id, name, state }) => ({ id, name, state, href: regionPath(id) }),
  );
}

/** A region and its locations as cards, the next place marked. */
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

/** A location and its region, each with its state. */
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
    location: { ...location, state: stateOf(joined.locations, location.id) },
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
 * renders, since its cards reveal nothing, and offers a retry.
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
