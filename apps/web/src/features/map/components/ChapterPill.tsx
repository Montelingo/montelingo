import Link from "next/link";

import { FOCUS_RING } from "@/components/ui/kid-styles";
import {
  TILE_STATE_STYLES,
  type TileStateStyle,
} from "@/components/ui/TileBadge";
import type { TileCardState } from "@/components/ui/tile-card-state";
import { cn } from "@/lib/cn";

type ChapterPillProps = {
  /** The lesson's or the game's name. */
  title: string;
  /** The tile state it is drawn in, so a place's pills read like the map's. */
  state: TileCardState;
  /** The state's words for this pill, such as "First watch the lesson". */
  label: string;
  /** Replaces the state's icon, such as a star for a completed game. */
  Icon?: TileStateStyle["Icon"];
  /**
   * The lesson's or the game's screen, when it can be opened. Without it the
   * pill is plain text: a locked game, or one with no screen yet.
   */
  href?: string | null;
};

// One of a chapter's lesson and games, as a compact pill in its state's badge
// colours: the state's icon, the name, then the state's words, so the state
// never rests on colour alone. One line high, so a place's chapters fit above
// its first words. A pill that opens its lesson or game is a link; one that
// cannot be opened is plain text.
export function ChapterPill({
  title,
  state,
  label,
  Icon,
  href,
}: ChapterPillProps) {
  const style = TILE_STATE_STYLES[state];
  const PillIcon = Icon ?? style.Icon;
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-badge px-3 py-1.5 text-base",
    style.badge,
  );
  const content = (
    <>
      <PillIcon aria-hidden="true" className="size-5 shrink-0" />
      <span className="font-bold">{title}</span>
      {/* A pause before the state, for screen readers; the gap shows it. */}
      <span className="sr-only">, </span>
      <span>{label}</span>
    </>
  );
  if (href === undefined || href === null) {
    return <span className={className}>{content}</span>;
  }
  return (
    <Link
      href={href}
      className={cn(
        className,
        "underline-offset-4 hover:underline",
        FOCUS_RING,
      )}
    >
      {content}
    </Link>
  );
}
