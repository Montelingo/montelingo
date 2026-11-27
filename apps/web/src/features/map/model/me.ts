import {
  type Explorer,
  PLACEHOLDER_EXPLORER,
  type Profile,
  toExplorer,
} from "@/features/profile/edge";

import type { ProgressCounts, ProgressResult } from "./progress";

// The Ja tab (screen 1 of #174): the child's buddy, name and title, and what
// they have collected. The server counts it all, stars too (ADR 0005, 0009).

export type MeData = {
  /**
   * The child, or before the profile is set up (or when it cannot be read)
   * the placeholder explorer, which has no title.
   */
  explorer: Pick<Explorer, "name" | "avatar"> & { title: string | null };
  /** The counts, or `null` when progress failed: then they are not known. */
  counts: ProgressCounts | null;
  /** Whether progress or the profile failed, which offers a retry. */
  needsRetry: boolean;
};

/** Joins progress and the profile (`null` when it failed) for the Ja tab. */
export function toMeData(
  progress: ProgressResult,
  profile: Profile | null,
): MeData {
  const explorer = profile === null ? null : toExplorer(profile);
  return {
    explorer: explorer ?? { ...PLACEHOLDER_EXPLORER, title: null },
    counts: progress.status === "ready" ? progress.progress.counts : null,
    needsRetry: progress.status === "error" || profile === null,
  };
}
