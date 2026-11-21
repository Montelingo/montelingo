// The games feature's public API: a chapter's games (ADR 0006). Each takes the
// chapter's words and does no fetching; its route loads them, and shows
// GameUnavailable instead when the server has not opened the game.
export {
  GameUnavailable,
  type GameUnavailableProps,
  gameUnavailableReason,
} from "./components/GameUnavailable";
export { MatchGame, type MatchGameProps } from "./components/MatchGame";
export { MemoryGame, type MemoryGameProps } from "./components/MemoryGame";
export { type GameReward } from "./components/BravoScreen";
export { canDealMatchGame, type MatchWord } from "./model/match";
export { canDealMemoryGame, type MemoryWord } from "./model/memory";
