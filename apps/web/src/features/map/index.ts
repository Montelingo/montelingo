// The map feature's public API: the only place that knows the content and
// progress API. Screens get domain objects with a state already attached. The
// adapters (listRegions, getRegion, getLocation, getProgress), the screen
// loaders and the location gate, and the error mapping, which need the API
// client, are server-only and exported from ./server. Saving a finished
// lesson or game runs in the browser: useSaveResult, with SaveNotice for its
// retry.
export { ChapterScreen } from "./components/ChapterScreen";
export { LocationScreen } from "./components/LocationScreen";
export { MapArt } from "./components/MapArt";
export { LocationScreenSkeleton } from "./components/LocationScreenSkeleton";
export { MapHome } from "./components/MapHome";
export { MapHomeSkeleton } from "./components/MapHomeSkeleton";
export { PrizesScreen } from "./components/PrizesScreen";
export { PrizesScreenSkeleton } from "./components/PrizesScreenSkeleton";
export { RegionScreen } from "./components/RegionScreen";
export { RegionScreenSkeleton } from "./components/RegionScreenSkeleton";
export { SaveNotice, type SaveNoticeProps } from "./components/SaveNotice";
export {
  type ChapterResult,
  type SaveResult,
  type SaveStatus,
  useSaveResult,
} from "./hooks/use-save-result";
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
  type MapLocationLink,
  type MapElementState,
  type MapLocationState,
  type MapRegionState,
  type ServerMapState,
  type MapRegionLink,
} from "./model/map-state";
export { parseMapNotice } from "./model/notices";
export {
  chapterPath,
  gamePath,
  lessonPath,
  locationPath,
  regionPath,
} from "./model/paths";
export {
  joinProgress,
  pickNextPlace,
  type Progress,
  type GameId,
  type GameState,
  type ProgressResult,
  type WithState,
} from "./model/progress";
export type {
  ChapterScreenData,
  GameScreenData,
  LocationScreenData,
  RegionScreenData,
} from "./model/screens";
