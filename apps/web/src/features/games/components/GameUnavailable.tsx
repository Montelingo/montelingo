import {
  InformationCircleIcon,
  LockClosedIcon,
  PhotoIcon,
} from "@heroicons/react/24/solid";
import Link from "next/link";
import type { ReactNode } from "react";

import { ACTION_SIZE_STYLES, ACTION_STYLE } from "@/components/ui/action-style";
import { LOCKED_GAME_MESSAGE } from "@/features/map/edge";
import { cn } from "@/lib/cn";

export type GameUnavailableProps = {
  /** The page's h1: the game's and the chapter's name. */
  heading: ReactNode;
  /**
   * `locked`: the server has not opened the game, since the lesson is not
   * done. `not-loaded`: the server sent no state for it. `no-pictures`: it is
   * open, but the chapter does not have enough pictures yet to deal it.
   */
  reason: "locked" | "not-loaded" | "no-pictures";
  /** The chapter's lesson, which opens its games. */
  lessonHref: string;
  /** The place's screen. */
  placeHref: string;
};

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
} as const;

// What a game's page shows instead of the game. When the server has not opened
// it: the lock message, the same words as the game's card on the place's
// screen, with the way to the lesson; never the game, since only the server
// opens one (ADR 0006). When its state did not load: a calm note that puts
// the problem on our side. When the chapter's pictures are not there yet: a
// note that they are coming. Both of those lead back to the place.
export function GameUnavailable({
  heading,
  reason,
  lessonHref,
  placeHref,
}: GameUnavailableProps) {
  const { Icon, message, action } = COPY[reason];
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className="text-3xl font-bold text-ink">{heading}</h1>
      <div className="flex items-center gap-3">
        <Icon aria-hidden="true" className="size-10 shrink-0 text-ink" />
        <p className="text-xl text-ink">{message}</p>
      </div>
      <Link
        href={reason === "locked" ? lessonHref : placeHref}
        className={cn(ACTION_STYLE, ACTION_SIZE_STYLES.large)}
      >
        {action}
      </Link>
    </div>
  );
}
