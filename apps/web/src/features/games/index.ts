// The games feature's public API: a chapter's games (ADR 0006). Each takes the
// chapter's words and does no fetching; its route loads them, and shows
// GameUnavailable instead when the server has not opened the game.
export {
  GameUnavailable,
  type GameUnavailableProps,
} from "./components/GameUnavailable";
export {
  MemoryGame,
  type MemoryGameProps,
  type MemoryReward,
} from "./components/MemoryGame";
export { canDealMemoryGame, type MemoryWord } from "./model/memory";
