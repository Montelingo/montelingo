import "server-only";

// The profile feature's server-only public API, for Server Components and
// loaders. Kept apart from ./index so that importing the feature from a
// Client Component never pulls the API client into the browser bundle.
export { getProfile, type ProfileResult, readProfile } from "./api/profile-api";
