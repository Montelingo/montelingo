// The map feature's public API: the only place that knows the content and
// progress API. Screens get domain objects with a state already attached. The
// adapters (listRegions, getRegion, getLocation, getProgress) and the error
// mapping, which need the API client, are server-only and exported from ./server.
export type {
  Chapter,
  Location,
  LocationDetail,
  Region,
  RegionDetail,
  Word,
} from "./model/content";
export {
  MAP_ELEMENT_STATES,
  type MapElementState,
  type MapLocationState,
  type MapRegionState,
  type ServerMapState,
  type OnLocationSelect,
  type OnRegionSelect,
} from "./model/map-state";
export {
  joinProgress,
  pickNextPlace,
  type Progress,
  type ProgressResult,
  type WithState,
} from "./model/progress";
