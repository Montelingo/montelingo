import {
  type Explorer,
  PLACEHOLDER_EXPLORER,
  type Profile,
  toExplorer,
} from "@/features/profile/edge";

import type { Region, RegionDetail } from "./content";
import {
  joinProgress,
  type ProgressCounts,
  type ProgressResult,
} from "./progress";

// The grown-ups area's progress card (screen 3 of #174): the child's buddy
// and name, a row per region with its completed places, and the counts. The
// server decides every state and count (ADR 0005); this only adds them up.

export type RegionProgress = {
  id: string;
  name: string;
  /** Its `completed` places, or `null` when progress failed. */
  completed: number | null;
  /** All its places. */
  total: number;
};

export type GrownUpsData = {
  /** The child, or the placeholder explorer (see `MeData`). */
  explorer: Pick<Explorer, "name" | "avatar">;
  /** Every region, in content order. */
  regions: RegionProgress[];
  /** The counts, or `null` when progress failed. */
  counts: ProgressCounts | null;
  /** Whether progress or the profile failed, which offers a retry. */
  needsRetry: boolean;
};

/**
 * Joins the regions, their places, progress and the profile (`null` when it
 * failed) for the grown-ups area. A place counts once it is `completed`.
 */
export function toGrownUpsData(
  regions: readonly Region[],
  details: readonly RegionDetail[],
  progress: ProgressResult,
  profile: Profile | null,
): GrownUpsData {
  const placesOf = new Map(details.map(({ id, locations }) => [id, locations]));
  const { locations } = joinProgress(
    {
      regions,
      locations: regions.flatMap(({ id }) => placesOf.get(id) ?? []),
    },
    progress,
  );
  const isReady = progress.status === "ready";
  const { name, avatar } =
    (profile === null ? null : toExplorer(profile)) ?? PLACEHOLDER_EXPLORER;
  return {
    explorer: { name, avatar },
    regions: regions.map((region) => {
      const places = locations.filter(({ regionId }) => regionId === region.id);
      return {
        id: region.id,
        name: region.name,
        completed: isReady
          ? places.filter(({ state }) => state === "completed").length
          : null,
        total: places.length,
      };
    }),
    counts: isReady ? progress.progress.counts : null,
    needsRetry: !isReady || profile === null,
  };
}

/** "8 naučenih riječi · 2 naljepnice", with the Montenegrin plurals. */
export function countsText({
  wordsLearned,
  stickers,
}: Pick<ProgressCounts, "wordsLearned" | "stickers">): string {
  const words = pluralOf(wordsLearned, [
    "naučena riječ",
    "naučene riječi",
    "naučenih riječi",
  ]);
  const prizes = pluralOf(stickers, ["naljepnica", "naljepnice", "naljepnica"]);
  return `${wordsLearned} ${words} · ${stickers} ${prizes}`;
}

// Montenegrin counts three ways: 1, 21, 31… take the first form, 2–4, 22–24…
// the second, and the rest (0, 5–20, 25…) the third.
function pluralOf(
  count: number,
  [one, few, many]: readonly [string, string, string],
): string {
  const last = count % 10;
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) {
    return many;
  }
  if (last === 1) {
    return one;
  }
  return last >= 2 && last <= 4 ? few : many;
}
