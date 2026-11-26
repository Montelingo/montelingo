import {
  BookOpenIcon,
  InformationCircleIcon,
  LockClosedIcon,
  PhotoIcon,
} from "@heroicons/react/24/solid";
import Link from "next/link";
import type { ReactNode } from "react";

import { ACTION_SIZE_STYLES, ACTION_STYLE } from "@/components/ui/action-style";
import { CONTENT_LANG, LOCKED_GAME_MESSAGE } from "@/features/map/edge";
import { cn } from "@/lib/cn";

export type GameUnavailableProps = {
  /** The page's h1: the game's and the chapter's name. */
  heading: ReactNode;
  /**
   * `locked`: the server has not opened the game, since the lesson is not
   * done. `not-loaded`: the server sent no state for it. `no-pictures`: it is
   * open, but the chapter does not have enough pictures yet to deal it.
   * `too-few-words`: practice, before the child has learned enough words
   * with a picture to deal it.
   */
  reason: "locked" | "not-loaded" | "no-pictures" | "too-few-words";
  /** The chapter's lesson, which opens its games. */
  lessonHref: string;
  /** The place's screen, or for practice, Riječi. */
  placeHref: string;
  /**
   * The way back to `placeHref`'s label, in Montenegrin like the games' own
   * copy, when it is not the reason's own: practice's "Nazad na riječi".
   */
  backLabel?: string;
};

/**
 * Why a game's page cannot show the game, or `null` when it can. `gameState`
 * is the game's state as the server sent it (`null` when it sent none), and
 * `canDeal` whether the chapter's words deal the game.
 */
export function gameUnavailableReason(
  gameState: "locked" | "available" | "completed" | null,
  canDeal: boolean,
): GameUnavailableProps["reason"] | null {
  if (gameState === null) {
    return "not-loaded";
  }
  if (gameState === "locked") {
    return "locked";
  }
  return canDeal ? null : "no-pictures";
}

const COPY = {
  locked: {
    Icon: LockClosedIcon,
    message: `${LOCKED_GAME_MESSAGE}. Then you can play.`,
    action: "Watch the lesson",
  },
  "not-loaded": {
    Icon: InformationCircleIcon,
    message: "This game didn’t load. Something went wrong on our side.",
    action: "Back to the place",
  },
  "no-pictures": {
    Icon: PhotoIcon,
    message: "This game’s pictures are coming soon.",
    action: "Back to the place",
  },
  "too-few-words": {
    Icon: BookOpenIcon,
    message: "Nauči još riječi pa se vrati!",
    action: "Nazad na riječi",
    lang: CONTENT_LANG,
  },
} satisfies Record<
  GameUnavailableProps["reason"],
  { Icon: typeof PhotoIcon; message: string; action: string; lang?: string }
>;

// What a game's page shows instead of the game. When the server has not opened
// it: the lock message, the same words as the game's card on the place's
// screen, with the way to the lesson; never the game, since only the server
// opens one (ADR 0006). When its state did not load: a calm note that puts
// the problem on our side. When the chapter's pictures are not there yet: a
// note that they are coming. Both of those lead back to the place. Practice,
// with too few words yet, says to learn more, and leads back to Riječi.
export function GameUnavailable({
  heading,
  reason,
  lessonHref,
  placeHref,
  backLabel,
}: GameUnavailableProps) {
  const copy: (typeof COPY)[keyof typeof COPY] & { lang?: string } =
    COPY[reason];
  const { Icon, message, lang } = copy;
  // The lesson is the only way on from a locked game, and keeps its label.
  const ownBack = reason === "locked" ? undefined : backLabel;
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-3xl font-bold text-ink">{heading}</h1>
      <div className="flex items-center gap-3">
        <Icon aria-hidden="true" className="size-10 shrink-0 text-ink" />
        <p lang={lang} className="text-xl text-ink">
          {message}
        </p>
      </div>
      <Link
        href={reason === "locked" ? lessonHref : placeHref}
        lang={ownBack === undefined ? lang : CONTENT_LANG}
        className={cn(ACTION_STYLE, ACTION_SIZE_STYLES.large)}
      >
        {ownBack ?? copy.action}
      </Link>
    </div>
  );
}
