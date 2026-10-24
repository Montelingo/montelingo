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
