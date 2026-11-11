// The map feature's public API: the only place that knows the content and
// progress API. Screens get domain objects with a state already attached. The
// adapters (listRegions, getRegion, getLocation, getProgress), the screen
// loaders and the location gate, and the error mapping, which need the API
// client, are server-only and exported from ./server.
export { LocationPicker } from "./components/LocationPicker";
export { MapHome } from "./components/MapHome";
export { MapHomeSkeleton } from "./components/MapHomeSkeleton";
export { RegionPicker } from "./components/RegionPicker";
export { RegionScreen } from "./components/RegionScreen";
export { RegionScreenSkeleton } from "./components/RegionScreenSkeleton";
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
  type LocationPickerLocation,
  type MapElementState,
  type MapLocationState,
  type MapRegionState,
  type ServerMapState,
  type OnLocationSelect,
  type OnRegionSelect,
  type RegionPickerRegion,
} from "./model/map-state";
export { parseMapNotice } from "./model/notices";
export { locationPath, regionPath } from "./model/paths";
export {
  joinProgress,
  pickNextPlace,
  type Progress,
  type ProgressResult,
  type WithState,
} from "./model/progress";
export type { LocationScreenData, RegionScreenData } from "./model/screens";
