// The privacy feature's side-effect-free API: the page's path and the policy
// version, with no components or policy text. Other features import it, so
// their modules never pull in the page (see the auth feature's edge.ts).
export { PRIVACY_PATH, PRIVACY_POLICY_VERSION } from "./model/policy";
