import "server-only";

// The map feature's server-only public API, for Server Components and layouts.
// Kept apart from ./index so that importing the feature from a Client
// Component never pulls the API client into the browser bundle.
export { getLocation, getRegion, listRegions } from "./api/content-api";
export { getProgress } from "./api/progress-api";
export {
  assertLocationOpen,
  loadRegionName,
  loadRegionPicker,
  loadRegionScreen,
} from "./api/screens-api";
export { mapErrorMessages, toMapErrorMessage } from "./errors";
