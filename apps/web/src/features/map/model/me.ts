import {
  canSwitchPlayer,
  type Explorer,
  PLACEHOLDER_EXPLORER,
  type Player,
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
  /**
   * Whether to offer Switch player (#184): the account has two players or
   * more. Not when the players could not be read, which needs no retry.
   */
  canSwitchPlayer: boolean;
};

/**
 * Joins progress, the profile and the players (each `null` when it failed)
 * for the Ja tab.
 */
export function toMeData(
  progress: ProgressResult,
  profile: Profile | null,
  players: readonly Player[] | null,
): MeData {
  const explorer = profile === null ? null : toExplorer(profile);
  return {
    explorer: explorer ?? { ...PLACEHOLDER_EXPLORER, title: null },
    counts: progress.status === "ready" ? progress.progress.counts : null,
    needsRetry: progress.status === "error" || profile === null,
    canSwitchPlayer: players !== null && canSwitchPlayer(players),
  };
}
