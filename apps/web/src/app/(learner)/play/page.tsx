import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";

import { MapHome, parseMapNotice } from "@/features/map";
import { loadMap } from "@/features/map/server";
import { needsSetup, PROFILE_SETUP_PATH } from "@/features/profile/edge";
import { getProfile } from "@/features/profile/server";

export const metadata: Metadata = {
  title: "Mapa",
};

type PlayPageProps = {
  searchParams: Promise<{ notice?: string | string[] }>;
};

export default async function PlayPage({ searchParams }: PlayPageProps) {
  const { notice } = await searchParams;
  // A child whose profile is not set up sets it up first (#118): after sign-up,
  // and once for accounts made before it. Checked before the map loads, so the
  // redirect does not wait for every region. A failure, a 401 included, lets
  // the map load: loadMap() reads the same cached call and sends a signed-out
  // learner to sign in.
  const profile = await getProfile().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  });
  if (needsSetup(profile)) {
    redirect(PROFILE_SETUP_PATH);
  }
  const map = await loadMap();

  return <MapHome {...map} notice={parseMapNotice(notice)} />;
}
