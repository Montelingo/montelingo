import type { Metadata } from "next";

import { PracticeGame, practiceTitle } from "@/features/games";
import { loadPractice } from "@/features/map/server";

export const metadata: Metadata = {
  title: practiceTitle("spell"),
};

// Vješalo with every learned word (#298): practice only, no chapter has it
// (#294). Recorded as a heart: see PracticeGame.
export default async function PracticeSpellPage() {
  return <PracticeGame gameId="spell" {...await loadPractice("spell")} />;
}
