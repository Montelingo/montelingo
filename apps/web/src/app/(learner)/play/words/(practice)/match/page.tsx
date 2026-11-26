import type { Metadata } from "next";

import { PracticeGame, practiceTitle } from "@/features/games";
import { loadPractice } from "@/features/map/server";

export const metadata: Metadata = {
  title: practiceTitle("match"),
};

// Practice match with every learned word (#235). Not recorded: see PracticeGame.
export default async function PracticeMatchPage() {
  return <PracticeGame gameId="match" {...await loadPractice("match")} />;
}
