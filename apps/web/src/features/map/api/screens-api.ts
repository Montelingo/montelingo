import "server-only";

import { notFound, redirect } from "next/navigation";

import { PLAY_PATH } from "@/features/auth/edge";

import { redirectOnSignedOut } from "../errors";
import type { RegionPickerRegion } from "../model/map-state";
import { locationPath, regionPath } from "../model/paths";
import {
  closedLocationRedirect,
  type LocationScreenData,
  lockedRegionRedirect,
  type RegionScreenData,
  toLocationScreen,
  toRegionPickerRegions,
  toRegionScreen,
} from "../model/screens";
import { getLocation, getRegion, listRegions } from "./content-api";
import { getProgress } from "./progress-api";

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
 * The map: every region, with its state and link. Redirects to sign in when
 * the session has ended.
 */
export async function loadRegionPicker(): Promise<RegionPickerRegion[]> {
  const [regions, progress] = await signedIn(PLAY_PATH, [
    listRegions(),
    getProgress(),
  ]);
  return toRegionPickerRegions(regions, progress);
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
 * (`loading` or `error`) to the region, whose screen offers a retry.
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
