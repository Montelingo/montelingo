import type { Metadata } from "next";

import { MapHome, parseMapNotice } from "@/features/map";
import { loadMap } from "@/features/map/server";

export const metadata: Metadata = {
  title: "Mapa",
};

type PlayPageProps = {
  searchParams: Promise<{ notice?: string | string[] }>;
};

export default async function PlayPage({ searchParams }: PlayPageProps) {
  const { notice } = await searchParams;
  const map = await loadMap();

  return <MapHome {...map} notice={parseMapNotice(notice)} />;
}
