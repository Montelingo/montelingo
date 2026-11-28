import { PLAY_PATH } from "@/features/auth/edge";
import { PLAYERS_PATH, PROFILE_SETUP_PATH } from "@/features/profile/edge";

export type LearnerSkeleton =
  | "map"
  | "region"
  | "location"
  | "players"
  | "page";

/**
 * Which page's skeleton stands in for `pathname` while the learner area loads,
 * matching the routes under /play: the map, /play/<region>,
 * /play/<region>/<location>, the player picker, and the neutral one for
 * everything else (the profile setup, or a path no page matches).
 */
export function learnerSkeletonFor(pathname: string | null): LearnerSkeleton {
  if (pathname === null || pathname === PROFILE_SETUP_PATH) return "page";
  const path = pathname.replace(/\/+$/, "");
  if (path === PLAY_PATH) return "map";
  if (path === PLAYERS_PATH) return "players";
  if (!path.startsWith(`${PLAY_PATH}/`)) return "page";
  const segments = path.slice(PLAY_PATH.length + 1).split("/");
  if (segments.length === 1) return "region";
  if (segments.length === 2) return "location";
  return "page";
}
