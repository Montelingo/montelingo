import type { Region, RegionDetail } from "./content";
import { joinProgress, type ProgressResult } from "./progress";
import { needsProgressRetry } from "./screens";

// The Prizes tab ("My prizes" in Figma): one sticker per place, grouped by
// region. A sticker is earned when its place is completed; stars come from
// the backend later, so the screen takes them as props (#163).

/** The most stars a place can give. */
export const STARS_PER_PLACE = 3;

// A sticker's art in public/learner, by place id, as the designers export
// it. A place without art yet gets a placeholder circle.
const STICKER_ART: Readonly<Record<string, string>> = {};

export type Sticker = {
  id: string;
  name: string;
  /** The place is completed. */
  isEarned: boolean;
  /** The sticker's art, or `null` for the placeholder circle. */
  artUrl: string | null;
};

export type PrizeRegion =
  | {
      kind: "open";
      id: string;
      name: string;
      /** STARS_PER_PLACE for each of its places. */
      maxStars: number;
      stickers: Sticker[];
    }
  | {
      kind: "locked";
      id: string;
      name: string;
      /** How many stickers it hides: its `locationCount`. */
      stickerCount: number;
    };

export type PrizesData = {
  regions: PrizeRegion[];
  /** Whether a region or place has no state from the server yet. */
  needsProgressRetry: boolean;
};

/**
 * Every region in content order: a locked one (`locked` in progress) with its
 * sticker count only, an open one with a sticker per place. When progress
 * failed, every region is open and no sticker is earned.
 */
export function toPrizesData(
  regions: readonly Region[],
  details: readonly RegionDetail[],
  progress: ProgressResult,
): PrizesData {
  const placesOf = new Map(details.map(({ id, locations }) => [id, locations]));
  const joined = joinProgress(
    {
      regions,
      locations: regions.flatMap(({ id }) => placesOf.get(id) ?? []),
    },
    progress,
  );
  // A locked region shows no stickers, so its places' states do not matter.
  const lockedIds = new Set(
    joined.regions
      .filter(({ state }) => state === "locked")
      .map(({ id }) => id),
  );
  return {
    needsProgressRetry: needsProgressRetry([
      ...joined.regions,
      ...joined.locations.filter(({ regionId }) => !lockedIds.has(regionId)),
    ]),
    regions: joined.regions.map((region): PrizeRegion => {
      if (region.state === "locked") {
        return {
          kind: "locked",
          id: region.id,
          name: region.name,
          stickerCount: region.locationCount,
        };
      }
      const stickers = joined.locations
        .filter(({ regionId }) => regionId === region.id)
        .map(({ id, name, state }) => ({
          id,
          name,
          isEarned: state === "completed",
          artUrl: STICKER_ART[id] ?? null,
        }));
      return {
        kind: "open",
        id: region.id,
        name: region.name,
        maxStars: stickers.length * STARS_PER_PLACE,
        stickers,
      };
    }),
  };
}

/** "N naljepnica se krije u oblacima", with the Montenegrin plural. */
export function hiddenStickersText(count: number): string {
  // 2–4 (but not 12–14) take the paucal; 1 and 5+ say "naljepnica se krije".
  const lastTwo = count % 100;
  const last = count % 10;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} naljepnice se kriju u oblacima`;
  }
  return `${count} naljepnica se krije u oblacima`;
}
