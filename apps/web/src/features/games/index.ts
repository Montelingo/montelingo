// The games feature's public API: a chapter's games (ADR 0006). Each takes the
// chapter's words and does no fetching; the route (#135) loads them.
export {
  MemoryGame,
  type MemoryGameProps,
  type MemoryReward,
} from "./components/MemoryGame";
export type { MemoryWord } from "./model/memory";
