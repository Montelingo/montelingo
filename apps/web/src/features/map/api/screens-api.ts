import "server-only";

import { notFound, redirect } from "next/navigation";

import { PLAY_PATH } from "@/features/auth/edge";
import { type Profile, toExplorer } from "@/features/profile/edge";
import { getPlayers, getProfile } from "@/features/profile/server";

import { redirectOnSignedOut } from "../errors";
import type { LocationDetail, Region, RegionDetail } from "../model/content";
import { type GrownUpsData, toGrownUpsData } from "../model/grown-ups";
import { type MapData, type RegionMapData, toMapData } from "../model/map-view";
import { type MeData, toMeData } from "../model/me";
import {
  GROWN_UPS_PATH,
  ME_PATH,
  PRIZES_PATH,
  WORDS_PATH,
  chapterPath,
  gamePath,
  lessonPath,
  locationPath,
  practicePath,
  regionPath,
} from "../model/paths";
import { type PrizesData, toPrizesData } from "../model/prizes";
import {
  type ChapterScreenData,
  closedLocationRedirect,
  type GameScreenData,
  gameStateOf,
  type LocationScreenData,
  lockedRegionRedirect,
  type RegionScreenData,
  toChapterScreen,
  toLocationScreen,
  toRegionScreen,
} from "../model/screens";
import type { GameId, ProgressResult } from "../model/progress";
import { type PracticeData, toWordsData, type WordsData } from "../model/words";
import { getLocation, getRegion, listRegions } from "./content-api";
import { getProgress } from "./progress-api";
import { getLearnedWords } from "./words-api";

// What the map's routes load: content and progress in parallel, joined into
// what a screen draws. Content failures reach the error boundary and unknown
// ids call `notFound()` (content-api); a progress failure still renders, with
// every place in the error state. A `401` from any call means the session
// ended mid-visit, which play/layout.tsx cannot see on a client-side
// navigation, so the loader sends the learner to sign in and back to its own
// screen. A loader waits for all its calls before deciding, so the outcome
// never depends on which call fails first: a `401` from any of them wins over
// every other failure, because a signed-out visitor signs in first and must
// not learn whether a region exists; otherwise the first failure in the order
// the calls are listed is thrown. Built on the cached adapters, so a page and
// its metadata share one call each.

/**
 * The whole map: every region with its places, each with its state and link.
 * Redirects to sign in when the session has ended.
 */
export async function loadMap(returnTo: string = PLAY_PATH): Promise<MapData> {
  const [regions, progress, profile] = await signedIn(returnTo, [
    listRegions(),
    getProgress(),
    getProfile(),
  ]);
  return mapOf(returnTo, regions, progress, profile);
}

// Every region's places, joined with progress into the whole map, and the
// child the side panel shows (null until the profile is set up, or when it
// cannot be read: the panel then shows its placeholder explorer).
async function mapOf(
  returnTo: string,
  regions: readonly Region[],
  progress: ProgressResult,
  profile: Profile | null,
): Promise<MapData> {
  const details = await signedIn(
    returnTo,
    regions.map(({ id }) => getRegion(id)),
  );
  return toMapData(
    details,
    progress,
    profile === null ? null : toExplorer(profile),
  );
}

/**
 * The Prizes screen: every region, a locked one with its sticker count, an
 * open one with a sticker per place. Redirects to sign in when the session
 * has ended; a progress failure still renders, with nothing earned.
 */
export async function loadPrizes(): Promise<PrizesData> {
  const [regions, progress] = await signedIn(PRIZES_PATH, [
    listRegions(),
    getProgress(),
  ]);
  const details = await signedIn(
    PRIZES_PATH,
    regions.map(({ id }) => getRegion(id)),
  );
  return toPrizesData(regions, details, progress);
}

/**
 * The Ja tab: the child, their counts, and whether there is another player
 * to switch to. Redirects to sign in when the session has ended; a progress
 * or profile failure still renders, with a retry, and a players failure
 * without Switch player.
 */
export async function loadMe(): Promise<MeData> {
  const [progress, profile, players] = await signedIn(ME_PATH, [
    getProgress(),
    getProfile(),
    getPlayers(),
  ]);
  return toMeData(progress, profile, players);
}

/**
 * The grown-ups area's progress card: every region with its completed places,
 * the counts, and the child; and the account's players. Redirects to sign in,
 * then back here, when the session has ended; a progress or profile failure
 * still renders, with a retry, and a players failure without the Players card.
 */
export async function loadGrownUps(): Promise<GrownUpsData> {
  const [regions, progress, profile, players] = await signedIn(GROWN_UPS_PATH, [
    listRegions(),
    getProgress(),
    getProfile(),
    getPlayers(),
  ]);
  const details = await signedIn(
    GROWN_UPS_PATH,
    regions.map(({ id }) => getRegion(id)),
  );
  return toGrownUpsData(regions, details, progress, profile, players);
}

/**
 * The Riječi tab: the child's learned words by place, and their buddy for the
 * empty state. Redirects to sign in when the session has ended; a words
 * failure still renders, with a retry, and a profile failure only means the
 * placeholder buddy.
 */
export async function loadWords(): Promise<WordsData> {
  const [words, profile] = await signedIn(WORDS_PATH, [
    getLearnedWords(),
    getProfile(),
  ]);
  return toWordsData(words, profile);
}

/**
 * A practice game's words (#235): every learned place, for the game to deal
 * from, and the learner's name. Redirects to sign in, then back to the game,
 * when the session has ended. Practice records nothing, so it needs no
 * progress.
 */
export async function loadPractice(gameId: GameId): Promise<PracticeData> {
  const [words, profile] = await signedIn(practicePath(gameId), [
    getLearnedWords(),
    getProfile(),
  ]);
  return {
    places: words.status === "ready" ? words.words.places : null,
    learnerName: profile?.name ?? null,
  };
}

/**
 * A region's map screen: the region and the whole map to zoom into. Calls
 * `notFound()` for an unknown region, redirects to sign in (once) when the
 * session has ended, and redirects a locked region to the map, with a notice
 * that says why, like `loadRegionScreen()`.
 *
 * Call it outside any try/catch: `notFound()` and `redirect()` throw.
 */
export async function loadRegionMap(regionId: string): Promise<RegionMapData> {
  const returnTo = regionPath(regionId);
  // The region first, so an unknown one is not found whatever else fails.
  const [region, regions, progress, profile] = await signedIn(returnTo, [
    getRegion(regionId),
    listRegions(),
    getProgress(),
    getProfile(),
  ]);
  const screen = toRegionScreen(region, progress);
  const leaveTo = lockedRegionRedirect(screen.region.state);
  if (leaveTo !== null) {
    redirect(leaveTo);
  }
  return {
    region: screen.region,
    ...(await mapOf(returnTo, regions, progress, profile)),
  };
}

/**
 * One region's screen. Calls `notFound()` for an unknown region, redirects to
 * sign in when the session has ended, and redirects a locked region to the
 * map, with a notice that says why. `loading` and `error` still render: the
 * cards reveal nothing, and the screen offers a retry.
 *
 * Call it outside any try/catch: `notFound()` and `redirect()` throw.
 */
export async function loadRegionScreen(
  regionId: string,
): Promise<RegionScreenData> {
  const [region, progress] = await signedIn(regionPath(regionId), [
    getRegion(regionId),
    getProgress(),
  ]);
  const screen = toRegionScreen(region, progress);
  const leaveTo = lockedRegionRedirect(screen.region.state);
  if (leaveTo !== null) {
    redirect(leaveTo);
  }
  return screen;
}

/**
 * A region's name, for its page's metadata: the same cached call as
 * `loadRegionScreen()`, without progress. Calls `notFound()` for an unknown
 * region, and redirects to sign in when the session has ended.
 */
export async function loadRegionName(regionId: string): Promise<string> {
  const [region] = await signedIn(regionPath(regionId), [getRegion(regionId)]);
  return region.name;
}

/**
 * The gate for a location's screen (`/play/[regionId]/[locationId]`), called
 * once before it renders anything. Calls `notFound()` for an unknown region or
 * location, or a location that is not in that region, and redirects to sign in
 * when the session has ended. Only the server opens a place (ADR 0005), so it
 * returns the location, with its chapters and words, and its region only when
 * both are open (`available`, `in-progress`, `completed`, or `active`).
 * Otherwise it redirects: a locked region to the map, a locked location to its
 * region, each with a notice that says why, and a state that is not known
 * (`loading` or `error`) to the region, whose screen offers a retry. The API
 * looks places up by their exact ids, so with the region check below, the
 * URL's parent, where the learner area's Back goes, is always the location's
 * region.
 *
 * Call it outside any try/catch: `notFound()` and `redirect()` throw.
 */
export async function assertLocationOpen(
  regionId: string,
  locationId: string,
): Promise<LocationScreenData> {
  const [region, location, progress] = await signedIn(
    locationPath(regionId, locationId),
    [getRegion(regionId), getLocation(locationId), getProgress()],
  );
  return openLocationScreen(region, location, progress);
}

/**
 * A chapter's lesson screen: the place's gate, then `notFound()` for a
 * chapter the place does not have. The lesson is never locked (ADR 0006):
 * once its place is open, it is.
 *
 * Call it outside any try/catch: `notFound()` and `redirect()` throw.
 */
export async function loadLessonScreen(
  regionId: string,
  locationId: string,
  chapterId: string,
): Promise<ChapterScreenData> {
  const returnTo = lessonPath(regionId, locationId, chapterId);
  return loadOpenChapter(regionId, locationId, chapterId, returnTo);
}

/**
 * A chapter's screen, with its lesson, games and words: the place's gate, then
 * `notFound()` for a chapter the place does not have.
 *
 * Call it outside any try/catch: `notFound()` and `redirect()` throw.
 */
export async function loadChapterScreen(
  regionId: string,
  locationId: string,
  chapterId: string,
): Promise<ChapterScreenData> {
  const returnTo = chapterPath(regionId, locationId, chapterId);
  return loadOpenChapter(regionId, locationId, chapterId, returnTo);
}

/**
 * A chapter's game screen: the chapter's gate, the game's state as the server
 * sent it, and the child's name for "Bravo, Mia!" (`null` until the profile
 * is set up, or when it cannot be read). Calls `notFound()` for a game the
 * chapter's state does not list. The page shows the game only when its state
 * is `available` or `completed`: a locked game, opened by URL, shows the lock
 * message instead, since only the server opens a game.
 *
 * Call it outside any try/catch: `notFound()` and `redirect()` throw.
 */
export async function loadGameScreen(
  regionId: string,
  locationId: string,
  chapterId: string,
  gameId: GameId,
): Promise<GameScreenData> {
  const returnTo = gamePath(regionId, locationId, chapterId, gameId);
  const [region, location, progress, profile] = await signedIn(returnTo, [
    getRegion(regionId),
    getLocation(locationId),
    getProgress(),
    getProfile(),
  ]);
  const screen = chapterOf(
    openLocationScreen(region, location, progress),
    chapterId,
  );
  const game = gameStateOf(screen.chapter, gameId);
  if (game === null) {
    notFound();
  }
  return {
    ...screen,
    gameState: game.state,
    learnerName: profile?.name ?? null,
  };
}

// A place's screen when the place and its region are open, after the checks
// assertLocationOpen() describes: notFound() or a redirect otherwise.
function openLocationScreen(
  region: RegionDetail,
  location: LocationDetail,
  progress: ProgressResult,
): LocationScreenData {
  // A real place under the wrong region, such as /play/coast/durmitor.
  if (location.regionId !== region.id) {
    notFound();
  }

  const screen = toLocationScreen(region, location, progress);
  const leaveTo = closedLocationRedirect(
    region.id,
    screen.region.state,
    screen.location.state,
  );
  if (leaveTo !== null) {
    redirect(leaveTo);
  }
  return screen;
}

// A chapter behind its place's gate. An ended session comes back to `returnTo`.
async function loadOpenChapter(
  regionId: string,
  locationId: string,
  chapterId: string,
  returnTo: string,
): Promise<ChapterScreenData> {
  const [region, location, progress] = await signedIn(returnTo, [
    getRegion(regionId),
    getLocation(locationId),
    getProgress(),
  ]);
  return chapterOf(openLocationScreen(region, location, progress), chapterId);
}

// One chapter of an open place, or notFound() for one it does not have.
function chapterOf(
  screen: LocationScreenData,
  chapterId: string,
): ChapterScreenData {
  const chapter = toChapterScreen(screen, chapterId);
  if (chapter === null) {
    notFound();
  }
  return chapter;
}

// The values of a loader's calls, in the order they were listed.
type Settled<Requests extends readonly unknown[]> = {
  -readonly [Index in keyof Requests]: Awaited<Requests[Index]>;
};

// Waits for every one of a loader's calls to settle, then returns their
// values in order. When any failed, a `401` from any of them sends the learner
// to sign in, then back to `returnTo`, even if another call failed first;
// otherwise the first failure in the order of `requests` is rethrown as it is,
// including Next.js's own `notFound()` signal, so nothing is swallowed here.
// Waiting for all of them, rather than the first failure, makes the outcome
// the same however the calls race.
async function signedIn<const Requests extends readonly unknown[]>(
  returnTo: string,
  requests: Requests,
): Promise<Settled<Requests>> {
  const values: unknown[] = [];
  const failures: unknown[] = [];
  for (const result of await Promise.allSettled(requests)) {
    if (result.status === "fulfilled") {
      values.push(result.value);
    } else {
      failures.push(result.reason);
    }
  }
  if (failures.length > 0) {
    for (const failure of failures) {
      redirectOnSignedOut(failure, returnTo);
    }
    throw failures[0];
  }
  // allSettled() keeps the order of `requests`, and none of them failed.
  return values as Settled<Requests>;
}
