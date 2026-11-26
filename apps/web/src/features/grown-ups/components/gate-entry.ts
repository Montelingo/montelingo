// Passing the gate over the Ja screen lets the grown-ups page that it opens
// in without asking again, once. It lives in this module's memory only, never
// in storage, so a reload or a pasted URL always shows the gate. It is only
// ever granted in the browser, from an event handler, so the server's copy
// of this module is never granted.

let isGranted = false;

/** The gate was just passed: the next grown-ups page may skip it. */
export function grantEntry(): void {
  isGranted = true;
}

/** Whether the gate was just passed on the way here. */
export function hasEntry(): boolean {
  return isGranted;
}

/** Uses up the entry, so the next visit asks again. */
export function clearEntry(): void {
  isGranted = false;
}
