import Link from "next/link";

import { FOCUS_RING } from "@/components/ui/kid-styles";
import { TileBadge, type TileStateStyle } from "@/components/ui/TileBadge";
import type { TileCardState } from "@/components/ui/tile-card-state";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

type ActivityCardProps = {
  /** The lesson's or the game's name. */
  title: string;
  /** Its own picture, whatever its state. */
  ActivityIcon: TileStateStyle["Icon"];
  /** The fill behind its picture while it can be opened. */
  fill: string;
  /** The tile state its badge is drawn in, so states read like the map's. */
  state: TileCardState;
  /** The state's words, such as "First watch the lesson". */
  label: string;
  /** Replaces the badge's icon, such as a star for a completed game. */
  Icon?: TileStateStyle["Icon"];
  /** Its screen, or `null` when it cannot be opened: the card is then text. */
  href: string | null;
};

// One of a chapter's lesson and games, as a big card: its picture, its name
// and its state as a badge, so the state never rests on colour alone. A card
// that opens is a raised link; one that cannot is flat, dashed, plain text.
// A row on a phone, a column from the `sm` width, where three fit side by side.
export function ActivityCard({
  title,
  ActivityIcon,
  fill,
  state,
  label,
  Icon,
  href,
}: ActivityCardProps) {
  const className = cn(
    fredoka.className,
    "flex w-full items-center gap-4 rounded-kid-lg border-3 p-4 sm:flex-col sm:text-center",
    href === null
      ? "border-dashed border-kid-muted bg-kid-fog text-kid-muted"
      : "border-kid-ink bg-white text-kid-ink shadow-raised-4",
  );
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-16 shrink-0 items-center justify-center rounded-full border-3",
          href === null
            ? "border-kid-line bg-white"
            : cn("border-kid-ink", fill),
        )}
      >
        <ActivityIcon className="size-9" />
      </span>
      <span className="flex min-w-0 flex-col items-start gap-1.5 sm:items-center">
        <span className="text-2xl font-semibold">{title}</span>
        {/* A pause before the state, for screen readers; the layout shows it. */}
        <span className="sr-only">, </span>
        <TileBadge state={state} label={label} Icon={Icon} />
      </span>
    </>
  );
  if (href === null) {
    return <div className={className}>{content}</div>;
  }
  return (
    <Link
      href={href}
      className={cn(className, "hover:bg-kid-cream", FOCUS_RING)}
    >
      {content}
    </Link>
  );
}
