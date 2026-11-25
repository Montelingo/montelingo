// The map feature's side-effect-free API: what other features need without
// pulling in the map's screens (see the auth feature's edge.ts). The sticker
// art needs only the map's geometry, so it is light enough to live here.
export { PlaceStickerArt } from "./components/PlaceCloseUp";
export { CONTENT_LANG } from "./model/content";
export { ME_PATH } from "./model/paths";
export { LOCKED_GAME_MESSAGE } from "./model/progress";
