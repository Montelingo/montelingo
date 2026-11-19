import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  LockClosedIcon,
  MapPinIcon,
  PlayIcon,
} from "@heroicons/react/24/solid";

import { cn } from "@/lib/cn";

import type { TileCardState } from "./tile-card-state";

// A tile's state, drawn: its colours and its badge, an icon and a label, so a
// state never rests on colour alone. Shared by TileCard and any card drawn in
// the same states. Not a client module, so Server Components can use it.

export type TileStateStyle = {
  Icon: typeof LockClosedIcon;
  /** The card's edge colour and surface. */
  card: string;
  /** The badge's background and text colour. */
  badge: string;
  icon?: string;
};

// Full class names, so Tailwind's content scan finds every one. Each state
// has an icon and a label as well as its colours.
export const TILE_STATE_STYLES: Record<TileCardState, TileStateStyle> = {
  locked: {
    Icon: LockClosedIcon,
    card: "border-tile-locked-edge bg-surface-muted",
    badge: "bg-tile-locked-badge text-tile-locked-ink",
  },
  available: {
    Icon: PlayIcon,
    card: "border-tile-available-edge bg-surface",
    badge: "bg-tile-available-badge text-tile-available-ink",
  },
  active: {
    Icon: MapPinIcon,
    card: "border-tile-active-edge bg-surface",
    badge: "bg-tile-active-badge text-tile-active-ink",
  },
  "in-progress": {
    Icon: ClockIcon,
    card: "border-tile-in-progress-edge bg-surface",
    badge: "bg-tile-in-progress-badge text-tile-in-progress-ink",
  },
  completed: {
    Icon: CheckCircleIcon,
    card: "border-tile-completed-edge bg-surface",
    badge: "bg-tile-completed-badge text-tile-completed-ink",
  },
  loading: {
    Icon: ArrowPathIcon,
    card: "border-dashed border-tile-loading-edge bg-surface",
    badge: "bg-tile-loading-badge text-tile-loading-ink",
    icon: "motion-safe:animate-spin",
  },
  error: {
    Icon: ExclamationCircleIcon,
    card: "border-tile-error-edge bg-surface",
    badge: "bg-tile-error-badge text-tile-error-ink",
  },
};

type TileBadgeProps = {
  state: TileCardState;
  /** The state's words, such as "Open". */
  label: string;
  /** Replaces the state's icon, for copy that fits the feature. */
  Icon?: TileStateStyle["Icon"];
};

/** The state badge: the state's icon and `label`, in the state's colours. */
export function TileBadge({ state, label, Icon }: TileBadgeProps) {
  const style = TILE_STATE_STYLES[state];
  const BadgeIcon = Icon ?? style.Icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-badge px-2.5 py-1 text-sm font-semibold",
        style.badge,
      )}
    >
      <BadgeIcon
        aria-hidden="true"
        className={cn("size-5 shrink-0", style.icon)}
      />
      {label}
    </span>
  );
}
