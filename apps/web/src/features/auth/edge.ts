// The auth feature's side-effect-free API: pure functions and constants only,
// with no API client, React components, or server-only code. The middleware,
// which runs in the Edge runtime before every matched request, imports it, and
// so do other features, whose modules may end up in the browser bundle (the
// map's paths, for example). Importing ./index there would pull the API client
// and the forms in with them.
export {
  isProtectedPath,
  PROTECTED_PATH_PREFIXES,
  signInRedirectFor,
} from "./model/protected-routes";
export {
  REQUESTED_PATH_HEADER,
  withRequestedPath,
} from "./model/requested-path";
export { PLAY_PATH, signInHref } from "./model/routes";
export { getSessionCookieName } from "./model/session-cookie";
