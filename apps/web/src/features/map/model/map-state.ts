// The states a region or location on the map can be drawn in (SVG map contract
// §10). The frontend adds active for the selected place, loading while its
// state is unknown, and error when progress could not be read.
export const MAP_ELEMENT_STATES = [
  "locked",
  "available",
  "active",
  "in-progress",
  "completed",
  "loading",
  "error",
] as const;

export type MapElementState = (typeof MAP_ELEMENT_STATES)[number];

// The states a place can be opened in, as TileCard draws them. Every other
// state keeps it shut: `locked`, and `loading` and `error`, where the server
// has not said the place is open (ADR 0005).
const OPEN_STATES: ReadonlySet<MapElementState> = new Set<MapElementState>([
  "available",
  "active",
  "in-progress",
  "completed",
]);

/** True when a place in `state` can be opened. */
export function isOpenState(state: MapElementState): boolean {
  return OPEN_STATES.has(state);
}

/** The only states the server decides (ADR 0005). */
export type ServerMapState = Extract<
  MapElementState,
  "locked" | "available" | "in-progress" | "completed"
>;

// The SVG map contract §19: what the map component is given and calls back.
type MapElement = { readonly id: string; readonly state: MapElementState };

export type MapRegionState = MapElement;

export type MapLocationState = MapElement;

export type OnRegionSelect = (regionId: string) => void;

export type OnLocationSelect = (locationId: string) => void;

// What the card screens draw for each element: the contract's id and state,
// plus the name to show and the link that opens it. The SVG map can take the
// same items and ignore what it does not need.

export type RegionPickerRegion = MapRegionState & {
  readonly name: string;
  readonly href: string;
};

export type LocationPickerLocation = MapLocationState & {
  readonly name: string;
  readonly href: string;
  /** The next place to go (`pickNextPlace()`); at most one per region. */
  readonly isNext: boolean;
};
