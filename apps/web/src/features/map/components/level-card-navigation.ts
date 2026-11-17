import type { Navigate } from "@/lib/use-navigate";

import { LEVEL_CARD_PARAM } from "../model/map-view";

// Marks the history entry a card was opened into on its own page, so closing
// it goes back to the entry before rather than adding another.
const OPENED_HERE = "levelCardOpenedHere";

// The level card opens and closes by changing only the URL's query, through
// the History API, which Next.js keeps useSearchParams() in step with: the
// card needs nothing from the server. (A router.push() to the same page with
// a new query also hangs in production, on Next.js 15.5, until some other
// update.) From another page, it navigates to the place's region first.
export function openLevelCard(href: string, navigate: Navigate) {
  if (
    new URL(href, window.location.href).pathname === window.location.pathname
  ) {
    window.history.pushState({ [OPENED_HERE]: true }, "", href);
  } else {
    navigate.push(href);
  }
}

// Closes the card: back to the entry it was opened from, when it was opened
// on this page, so one Back leaves the page; otherwise (a link or a reload)
// the URL loses `?place=` in place. Any other query stays.
export function closeLevelCard() {
  const state: unknown = window.history.state;
  if (
    typeof state === "object" &&
    state !== null &&
    OPENED_HERE in state &&
    state[OPENED_HERE] === true
  ) {
    window.history.back();
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete(LEVEL_CARD_PARAM);
  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}
