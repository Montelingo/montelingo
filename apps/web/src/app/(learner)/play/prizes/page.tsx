import type { Metadata } from "next";

import { PrizesScreen } from "@/features/map";
import { loadPrizes } from "@/features/map/server";

export const metadata: Metadata = {
  title: "Moje nagrade",
};

// The Prizes tab: a sticker per place, by region. Stars are not in the API
// yet (a backend ticket), so they are 0, as on the map's top bar.
export default async function PrizesPage() {
  const prizes = await loadPrizes();

  return <PrizesScreen {...prizes} stars={0} regionStars={{}} />;
}
