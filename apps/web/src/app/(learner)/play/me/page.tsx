import type { Metadata } from "next";

import { MeScreen } from "@/features/map";
import { loadMe } from "@/features/map/server";

export const metadata: Metadata = {
  title: "Ja",
};

// The Ja tab: the child's buddy, name and counts. Stars are not in the API
// yet (a backend ticket), so they are 0, as on the map's top bar.
export default async function MePage() {
  const me = await loadMe();

  return <MeScreen {...me} stars={0} />;
}
