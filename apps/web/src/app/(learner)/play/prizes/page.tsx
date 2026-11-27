import type { Metadata } from "next";

import { PrizesScreen } from "@/features/map";
import { loadPrizes } from "@/features/map/server";

export const metadata: Metadata = {
  title: "Moje nagrade",
};

// The Prizes tab: a sticker per place, by region, and the stars.
export default async function PrizesPage() {
  const prizes = await loadPrizes();

  return <PrizesScreen {...prizes} />;
}
