import type { Metadata } from "next";

import { MapHome, parseMapNotice } from "@/features/map";
import { loadRegionPicker } from "@/features/map/server";

export const metadata: Metadata = {
  title: "Your map",
};

type PlayPageProps = {
  searchParams: Promise<{ notice?: string | string[] }>;
};

export default async function PlayPage({ searchParams }: PlayPageProps) {
  const { notice } = await searchParams;
  const regions = await loadRegionPicker();

  return <MapHome regions={regions} notice={parseMapNotice(notice)} />;
}
