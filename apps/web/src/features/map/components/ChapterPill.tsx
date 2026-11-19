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
};

// One of a chapter's lesson and games, as a compact pill in its state's badge
// colours: the state's icon, the name, then the state's words, so the state
// never rests on colour alone. One line high, so a place's chapters fit above
// its first words. Not a control yet: the pills link to the lesson and games
// once their routes exist (#135).
export function ChapterPill({ title, state, label, Icon }: ChapterPillProps) {
  const style = TILE_STATE_STYLES[state];
  const PillIcon = Icon ?? style.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-badge px-3 py-1.5 text-base",
        style.badge,
      )}
    >
      <PillIcon aria-hidden="true" className="size-5 shrink-0" />
      <span className="font-bold">{title}</span>
      {/* A pause before the state, for screen readers; the gap shows it. */}
      <span className="sr-only">, </span>
      <span>{label}</span>
    </span>
  );
}
