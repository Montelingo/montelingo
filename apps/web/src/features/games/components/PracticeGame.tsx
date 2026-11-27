import { type GameId, WORDS_PATH } from "@/features/map";
import { CONTENT_LANG } from "@/features/map/edge";
import type { Random } from "@/lib/random";

import { canDealMatchGame } from "../model/match";
import { canDealMemoryGame } from "../model/memory";
import {
  PRACTICE_ROUNDS,
  type PracticePlace,
  type PracticeWord,
  practiceWords,
} from "../model/practice";
import { GameUnavailable } from "./GameUnavailable";
import { MatchGame } from "./MatchGame";
import { MemoryGame } from "./MemoryGame";

export type PracticeGameProps = {
  /** Which game to practise. */
  gameId: GameId;
  /** The learned places with their words, or `null` when they failed to load. */
  places: readonly PracticePlace[] | null;
  /** The learner's name, for "Bravo, Mia!". */
  learnerName: string | null;
  /** Shuffles the deal. Tests pass their own, so a deal repeats. */
  random?: Random;
};

const BACK_TO_WORDS = "Nazad na riječi";

// A Record, so a new game id fails to compile until it can be practised.
const GAMES: Record<
  GameId,
  { title: string; canDeal: (words: readonly PracticeWord[]) => boolean }
> = {
  memory: { title: "Memory", canDeal: canDealMemoryGame },
  match: { title: "Spoji riječi", canDeal: canDealMatchGame },
};

/** A practice game's page title: "Vježbaj: Memory". */
export function practiceTitle(gameId: GameId): string {
  return `Vježbaj: ${GAMES[gameId].title}`;
}

// Practice (#235, screen 2 of #237): a chapter's game, dealt from every word
// the child has learned, each text once. It is not recorded, so it is the game
// itself, not ChapterGame: no onCompleted, no save, and its "Bravo!" only
// praises, since the words are not new. It leads back to Riječi. Practice has
// no lock, so the only ways it cannot play are the words not loading and too
// few of them with a picture yet; the h1 is for screen readers only while the
// game is on screen, as on a chapter's game.
export function PracticeGame({
  gameId,
  places,
  learnerName,
  random,
}: PracticeGameProps) {
  const heading = <span lang={CONTENT_LANG}>{practiceTitle(gameId)}</span>;
  const words =
    places === null
      ? null
      : practiceWords(places).map(({ id, text, imageUrl }) => ({
          id,
          text,
          imageUrl,
        }));

  if (words === null || !GAMES[gameId].canDeal(words)) {
    return (
      <GameUnavailable
        heading={heading}
        reason={words === null ? "not-loaded" : "too-few-words"}
        // Practice is never locked, so it has no lesson to lead to.
        lessonHref={WORDS_PATH}
        placeHref={WORDS_PATH}
        backLabel={BACK_TO_WORDS}
      />
    );
  }

  const game = {
    words,
    placeHref: WORDS_PATH,
    backLabel: BACK_TO_WORDS,
    teachesWords: false,
    learnerName: learnerName ?? undefined,
    ...(random === undefined ? {} : { random }),
  };
  return (
    <>
      <h1 className="sr-only">{heading}</h1>
      {gameId === "memory" ? (
        <MemoryGame {...game} />
      ) : (
        <MatchGame {...game} rounds={PRACTICE_ROUNDS} />
      )}
    </>
  );
}
