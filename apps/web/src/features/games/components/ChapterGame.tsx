"use client";

import {
  type GameId,
  hasResultNotice,
  ResultNotice,
  useSaveResult,
} from "@/features/map";

import { MatchGame, type MatchGameProps } from "./MatchGame";
import { MemoryGame, type MemoryGameProps } from "./MemoryGame";

type SharedProps = Omit<
  MemoryGameProps & MatchGameProps,
  "onCompleted" | "saveNotice"
>;

// A Record, so a new game id fails to compile until it has its component.
const GAMES: Record<GameId, typeof MemoryGame | typeof MatchGame> = {
  memory: MemoryGame,
  match: MatchGame,
};

export type ChapterGameProps = SharedProps & {
  /** Which of the chapter's games this is. */
  gameId: GameId;
  /** The chapter whose game this is: what completing it records. */
  chapterId: string;
};

// A chapter's game that saves itself (#136, ADR 0006): completing it records
// the game, once a visit, through the map feature, which owns the progress
// API. The "Bravo!" screen shows a replay's heart (ADR 0009) and a failed
// save's retry.
export function ChapterGame({ gameId, chapterId, ...props }: ChapterGameProps) {
  const saved = useSaveResult(
    { kind: "game", chapterId, gameId },
    props.placeHref,
  );
  const saveNotice = hasResultNotice(saved) ? (
    <ResultNotice {...saved} />
  ) : null;
  const Game = GAMES[gameId];
  return <Game {...props} onCompleted={saved.save} saveNotice={saveNotice} />;
}
