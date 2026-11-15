import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
  const map = await loadMap();
  // A child whose profile is not set up sets it up first (#118): after sign-up,
  // and once for accounts made before it. loadMap() already read the profile
  // (cached), and sent a signed-out learner to sign in.
  if (needsSetup(await getProfile())) {
    redirect(PROFILE_SETUP_PATH);
  }

  return <MapHome {...map} notice={parseMapNotice(notice)} />;
}
