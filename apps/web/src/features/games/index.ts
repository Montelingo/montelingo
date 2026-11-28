// The games feature's public API: a chapter's games (ADR 0006), and practice
// with every learned word (#237), where Vješalo is the one practice-only game
// (#294). Each game takes its words and does no fetching; its route loads
// them, and shows GameUnavailable instead when the server has not opened the
// game.
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
export {
  PRACTICE_ROUNDS,
  practiceTitle,
  practiceWords,
} from "./model/practice";
export { SpellGame, type SpellGameProps } from "./components/SpellGame";
export { canDealSpellGame, spellLetters, type SpellWord } from "./model/spell";
export {
  PracticeGame,
  type PracticeGameProps,
} from "./components/PracticeGame";
export { ChapterGame, type ChapterGameProps } from "./components/ChapterGame";
