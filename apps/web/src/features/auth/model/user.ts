/** The signed-in user. `createdAt` is an ISO 8601 string, so it can be passed to Client Components. */
export type CurrentUser = {
  id: string;
  email: string;
  createdAt: string;
};

/**
 * The outcome of looking up the current user. `unavailable` means the lookup
 * failed (the API errored or did not answer in time), so it is not known
 * whether anyone is signed in. It implies the browser sent a session cookie:
 * without one there is no lookup, and the state is `signed-out`.
 */
export type AuthState =
  | { status: "signed-in"; user: CurrentUser }
  | { status: "signed-out" }
  | { status: "unavailable" };
