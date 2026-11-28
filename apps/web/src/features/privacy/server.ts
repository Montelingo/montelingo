import "server-only";

// The privacy feature's server-only API, for Server Components: the version
// in force, read from the API. Kept apart from ./index like the auth feature's.
export { getPrivacyPolicyVersion } from "./api/policy-version";
