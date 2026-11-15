import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PLAY_PATH } from "@/features/auth/edge";
import { loadMap } from "@/features/map/server";
import { type FirstStop, ProfileSetup } from "@/features/profile";
import { PROFILE_SETUP_PATH } from "@/features/profile/edge";
import { getProfile } from "@/features/profile/server";

export const metadata: Metadata = {
  title: "Ko istražuje?",
};

// The child's profile setup (#118). The map (play/page.tsx) sends a profile
// that is not set up here; one that is set up has nothing to do here and goes
// to the map. The map's next place is the "first stop" the last screen names.
// loadMap() runs first: it sends a signed-out learner to sign in, and it has
// already read the profile (cached) by the time it is checked here.
export default async function WelcomePage() {
  const { regions, places } = await loadMap(PROFILE_SETUP_PATH);
  const profile = await getProfile();
  if (profile?.isComplete) {
    redirect(PLAY_PATH);
  }

  const next = places.find(({ isNext }) => isNext);
  const region = regions.find(({ id }) => id === next?.regionId);
  const firstStop: FirstStop | null =
    next !== undefined && region !== undefined
      ? { name: next.name, regionName: region.name, order: next.order }
      : null;

  return <ProfileSetup firstStop={firstStop} />;
}
