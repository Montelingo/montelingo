import type { RegionDetail } from "./content";
import { MAP_GEOMETRY } from "./map-geometry";
import type {
  MapLocationLink,
  MapElementState,
  MapRegionLink,
} from "./map-state";
import { locationPath, regionPath } from "./paths";
import {
  joinProgress,
  pickNextPlace,
  type ProgressResult,
  type WithState,
} from "./progress";

// What the SVG map draws: every region and every place, each with its state,
// built from content and progress. The art and positions come from the Figma
// export (map-geometry.ts); the names and states come from the API.

export type MapPlace = MapLocationLink & {
  readonly regionId: string;
  /** The place's number in its region, from 1, in content order. */
  readonly order: number;
};

export type MapRegion = MapRegionLink & {
  /** How many of its places are completed, for the region's chip. */
  readonly completedCount: number;
  readonly placeCount: number;
};

export type MapData = {
  regions: MapRegion[];
  places: MapPlace[];
};

/** A region's map screen: the zoomed region, and the whole map. */
export type RegionMapData = MapData & {
  region: WithState<Pick<RegionDetail, "id" | "name">>;
};

/**
 * Every region and place, in content order, with the one next place marked.
 * A place the map has no art for (a new place before the next export) is left
 * out, since there is nowhere to draw it.
 */
export function toMapData(
  regions: readonly RegionDetail[],
  progress: ProgressResult,
): MapData {
  const joined = joinProgress(
    { regions, locations: regions.flatMap((region) => region.locations) },
    progress,
  );
  const places = joined.locations.filter(
    ({ id }) => id in MAP_GEOMETRY.locations,
  );
  const nextPlace = pickNextPlace(places);
  const orders = new Map<string, number>();
  return {
    regions: joined.regions.map(({ id, name, state, locations }) => ({
      id,
      name,
      state,
      href: regionPath(id),
      completedCount: places.filter(
        (place) => place.regionId === id && place.state === "completed",
      ).length,
      placeCount: locations.length,
    })),
    places: places.map(({ id, name, state, regionId }) => {
      const order = (orders.get(regionId) ?? 0) + 1;
      orders.set(regionId, order);
      return {
        id,
        name,
        state,
        regionId,
        order,
        href: locationPath(regionId, id),
        isNext: id === nextPlace?.id,
      };
    }),
  };
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * The part of the map the screen must show whole: the country, or one region
 * zoomed in, as the build script framed it (its outline and buildings, with
 * some room). The rest of the art fills the screen around it.
 */
export function mapViewBox(regionId: string | null): Box {
  const region =
    regionId === null
      ? undefined
      : MAP_GEOMETRY.regions[regionId as keyof typeof MAP_GEOMETRY.regions];
  return region?.focus ?? MAP_GEOMETRY.focus;
}

/** True when a region is drawn under fog: while it is locked. */
export function isFogged(state: MapElementState): boolean {
  return state === "locked";
}

/**
 * The region the map's chrome talks about: the zoomed region, or on the whole
 * map the region of the next place to go (else the first open one).
 */
export function currentRegion(
  regions: readonly MapRegion[],
  places: readonly MapPlace[],
  focusRegionId: string | null,
): MapRegion | null {
  const nextRegionId = places.find(({ isNext }) => isNext)?.regionId;
  return (
    regions.find(({ id }) => id === (focusRegionId ?? nextRegionId)) ??
    regions.find(({ state }) => !isFogged(state)) ??
    null
  );
}

/** The map URL's query parameter that opens a place's level card. */
export const LEVEL_CARD_PARAM = "place";

/** The place's level card: its region's map, with the card open over it. */
export function levelCardHref(
  place: Pick<MapPlace, "id" | "regionId">,
): string {
  return `${regionPath(place.regionId)}?${LEVEL_CARD_PARAM}=${encodeURIComponent(place.id)}`;
}
