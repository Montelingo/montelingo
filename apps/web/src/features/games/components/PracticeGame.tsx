"use client";

import {
  hasResultNotice,
  type PracticeGameId,
  ResultNotice,
  useSaveResult,
  WORDS_PATH,
} from "@/features/map";
import { CONTENT_LANG } from "@/features/map/edge";
import type { Random } from "@/lib/random";

import {
  PRACTICE_GAMES,
  PRACTICE_ROUNDS,
  type PracticePlace,
  practiceTitle,
  practiceWords,
} from "../model/practice";
import { GameUnavailable } from "./GameUnavailable";
import { MatchGame } from "./MatchGame";
import { MemoryGame } from "./MemoryGame";
import { SpellGame } from "./SpellGame";

export type PracticeGameProps = {
  /** Which game to practise. */
  gameId: PracticeGameId;
  /** The learned places with their words, or `null` when they failed to load. */
  places: readonly PracticePlace[] | null;
  /** The learner's name, for "Bravo, Mia!". */
  learnerName: string | null;
  /** Shuffles the deal. Tests pass their own, so a deal repeats. */
  random?: Random;
};

const BACK_TO_WORDS = "Nazad na riječi";

// Practice (#235, screen 2 of #237): a chapter's game, dealt from every word
// the child has learned, each text once. Every game played to the end is
// recorded, "Igraj ponovo"'s too, and may earn a heart (ADR 0009, #276): its
// "Bravo!" shows the heart or a failed save's retry, as a chapter game's does,
// and otherwise only praises, since the words are not new. Practice changes
// no lock, star or count. It leads back to Riječi. Practice has
// no lock, so the only ways it cannot play are the words not loading and too
// few of them with a picture yet; the h1 is for screen readers only while the
// game is on screen, as on a chapter's game.
export function PracticeGame({
  gameId,
  places,
  learnerName,
  random,
}: PracticeGameProps) {
  const saved = useSaveResult({ kind: "practice", gameId }, WORDS_PATH);
  const heading = <span lang={CONTENT_LANG}>{practiceTitle(gameId)}</span>;
  const words =
    places === null
      ? null
      : practiceWords(places).map(({ id, text, imageUrl }) => ({
          id,
          text,
          imageUrl,
        }));

  if (words === null || !PRACTICE_GAMES[gameId].canDeal(words)) {
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
    onCompleted: saved.save,
    reportsEveryGame: true,
    saveNotice: hasResultNotice(saved) ? <ResultNotice {...saved} /> : null,
    ...(random === undefined ? {} : { random }),
  };
  return (
    <>
      <h1 className="sr-only">{heading}</h1>
      {gameId === "memory" ? <MemoryGame {...game} /> : null}
      {gameId === "match" ? (
        <MatchGame {...game} rounds={PRACTICE_ROUNDS} />
      ) : null}
      {/* Vješalo deals its own five words and reports every game. */}
      {gameId === "spell" ? <SpellGame {...game} /> : null}
    </>
  );
}
