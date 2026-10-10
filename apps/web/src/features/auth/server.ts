import "server-only";

// The auth feature's server-only public API, for Server Components, layouts,
// and route handlers. Kept apart from ./index so that importing the feature from
// a Client Component never pulls server-only code into the browser bundle.
export { getCurrentUser } from "./api/session";
