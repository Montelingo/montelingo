// The lessons feature's public API: a chapter's lesson (#129, ADR 0006). It
// takes the chapter's words and does no fetching; the route (#135) loads them.
export { LessonCards, type LessonCardsProps } from "./components/LessonCards";
export type { LessonMode, LessonWord } from "./model/lesson";
