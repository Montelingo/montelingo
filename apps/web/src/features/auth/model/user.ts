/** The signed-in user. `createdAt` is an ISO 8601 string, so it can be passed to Client Components. */
export type CurrentUser = {
  id: string;
  email: string;
  createdAt: string;
};
