// The profile feature's side-effect-free API: types, constants and pure
// functions only, with no API client or components. Other features and the
// /play layout import it, so their modules never pull in the setup screens or
// the browser API client (see the auth feature's edge.ts).
export {
  AGE_BANDS,
  type AgeBand,
  type Avatar,
  AVATARS,
  PLACEHOLDER_EXPLORER,
  PLACEHOLDER_EXPLORER_NAME,
  avatarSrc,
  type Explorer,
  type Profile,
  toExplorer,
} from "./model/profile";
export { needsSetup, PROFILE_SETUP_PATH } from "./model/setup";
