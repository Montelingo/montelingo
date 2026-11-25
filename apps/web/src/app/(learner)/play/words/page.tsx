import type { Metadata } from "next";

import { WordsScreen } from "@/features/map";
import { loadWords } from "@/features/map/server";

export const metadata: Metadata = {
  title: "Moje riječi",
};

// The Riječi tab: every word the child has learned, by place (#234).
export default async function WordsPage() {
  return <WordsScreen {...await loadWords()} />;
}
