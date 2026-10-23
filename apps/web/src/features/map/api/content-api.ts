import "server-only";

import { unwrap } from "@app/api-client";
import { cache } from "react";

import { getApiClient } from "@/lib/api";

import { notFoundOnMissingContent } from "../errors";
import {
  type LocationDetail,
  type Region,
  type RegionDetail,
  toLocationDetail,
  toRegion,
  toRegionDetail,
} from "../model/content";
import {
  locationDetailSchema,
  regionDetailSchema,
  regionListSchema,
} from "../schemas";

// Content is the same for every account, but every route needs a session
// (ADR 0005), so the calls forward the request's cookies. Each adapter is
// wrapped in React `cache()`, so the layouts and pages of one server render
// share a call. Never call them inside a cached scope (`unstable_cache`,
// `"use cache"`). A failure is thrown to the route's error boundary, except an
// unknown id, which calls `notFound()`.

/** Every region, in content order. */
export const listRegions = cache(fetchRegions);

/** One region with its locations. Calls `notFound()` for an unknown id. */
export const getRegion = cache(fetchRegion);

/** One location with its chapters and words. Calls `notFound()` for an unknown id. */
export const getLocation = cache(fetchLocation);

// Exported for tests: React only memoizes cache() inside a server render.
export async function fetchRegions(): Promise<Region[]> {
  const body = await unwrap(
    getApiClient({ forwardCookies: true }).GET("/api/v1/regions"),
  );
  const { items, page } = regionListSchema.parse(body);
  // There are three regions, so the API returns them on one page. A second
  // page would mean a map with regions missing, so fail instead.
  if (page.has_more) {
    throw new Error("The region list has more than one page.");
  }
  return items.map(toRegion);
}

export async function fetchRegion(regionId: string): Promise<RegionDetail> {
  const body = await orNotFound(
    unwrap(
      getApiClient({ forwardCookies: true }).GET(
        "/api/v1/regions/{region_id}",
        { params: { path: { region_id: regionId } } },
      ),
    ),
  );
  return toRegionDetail(regionDetailSchema.parse(body));
}

export async function fetchLocation(
  locationId: string,
): Promise<LocationDetail> {
  const body = await orNotFound(
    unwrap(
      getApiClient({ forwardCookies: true }).GET(
        "/api/v1/locations/{location_id}",
        { params: { path: { location_id: locationId } } },
      ),
    ),
  );
  return toLocationDetail(locationDetailSchema.parse(body));
}

// An unknown id becomes `notFound()`; every other failure is rethrown.
async function orNotFound<Body>(request: Promise<Body>): Promise<Body> {
  try {
    return await request;
  } catch (error) {
    notFoundOnMissingContent(error);
    throw error;
  }
}
