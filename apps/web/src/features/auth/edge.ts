// The auth feature's API for the middleware, which runs in the Edge runtime
// before every matched request. Pure functions and constants only: importing
// ./index here would pull the API client and the forms into the middleware
// bundle.
export {
  isProtectedPath,
  PROTECTED_PATH_PREFIXES,
  signInRedirectFor,
} from "./model/protected-routes";
export { getSessionCookieName } from "./model/session-cookie";
