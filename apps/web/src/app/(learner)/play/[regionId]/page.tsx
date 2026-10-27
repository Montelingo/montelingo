import type { Metadata } from "next";

import { parseMapNotice, RegionScreen } from "@/features/map";
import { loadRegionName, loadRegionScreen } from "@/features/map/server";

type RegionPageProps = {
  params: Promise<{ regionId: string }>;
  searchParams: Promise<{ notice?: string | string[] }>;
};

// The region's name, from the same cached call as the page. An unknown region
// calls notFound() here too, and an ended session redirects to sign in.
export async function generateMetadata({
  params,
}: Pick<RegionPageProps, "params">): Promise<Metadata> {
  const { regionId } = await params;
  return { title: await loadRegionName(regionId) };
}

// An unknown region renders (learner)/not-found.tsx, an ended session goes to
// sign in, and a locked region sends the learner back to the map, which says
// why: all in the loader.
export default async function RegionPage({
  params,
  searchParams,
}: RegionPageProps) {
  const { regionId } = await params;
  const { notice } = await searchParams;
  const screen = await loadRegionScreen(regionId);
  return <RegionScreen {...screen} notice={parseMapNotice(notice)} />;
}
