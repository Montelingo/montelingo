import type { Metadata } from "next";

import { LocationScreen } from "@/features/map";
import { assertLocationOpen } from "@/features/map/server";

type LocationPageProps = {
  params: Promise<{ regionId: string; locationId: string }>;
};

// The place's name, through the same gate as the page, over the same cached
// calls: a place that may not open never gives its name to the tab, since
// the gate calls notFound() or redirects here too.
export async function generateMetadata({
  params,
}: LocationPageProps): Promise<Metadata> {
  const { regionId, locationId } = await params;
  const { location } = await assertLocationOpen(regionId, locationId);
  return { title: location.name };
}

// An unknown place, or one in another region, renders
// (learner)/not-found.tsx; an ended session goes to sign in; a place that is
// not open goes back to its region (or a locked region to the map), which
// says why; and a URL that is not the place's own redirects to it: all in the
// gate.
export default async function LocationPage({ params }: LocationPageProps) {
  const { regionId, locationId } = await params;
  const screen = await assertLocationOpen(regionId, locationId);
  return <LocationScreen {...screen} />;
}
