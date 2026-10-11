/**
 * Loads `path` as a new document, replacing the current history entry. Unlike
 * `router.replace()`, it drops all client state (the router cache, component
 * state), and Back does not return to the page the user left. A module of its
 * own so tests can replace it: jsdom cannot navigate.
 */
export function replaceDocument(path: string): void {
  window.location.replace(path);
}
