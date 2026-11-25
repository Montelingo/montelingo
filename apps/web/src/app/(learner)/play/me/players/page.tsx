import type { Metadata } from "next";

import { ME_PATH } from "@/features/map/edge";
import { PlayersScreen } from "@/features/profile";
import { loadPlayers } from "@/features/profile/server";

export const metadata: Metadata = {
  title: "Ko igra?",
};

// Switch player, from the Ja tab (#184): every player on the account, to
// choose who plays. Not behind the grown-ups gate (Figma: Ja → "Who's
// playing?" directly), since the gate is a speed bump, not security.
export default async function PlayersPage() {
  const players = await loadPlayers();

  return <PlayersScreen players={players} backHref={ME_PATH} />;
}
