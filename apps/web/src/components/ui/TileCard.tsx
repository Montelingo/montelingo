"use client";

import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  LockClosedIcon,
  MapPinIcon,
  PlayIcon,
  StarIcon,
} from "@heroicons/react/24/solid";
import Link from "next/link";
import {
  type AnimationEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/cn";

import { type TileCardState } from "./tile-card-state";

export type { TileCardState } from "./tile-card-state";

/** The states whose card can be opened. The others never navigate. */
const OPEN_STATES: ReadonlySet<TileCardState> = new Set<TileCardState>([
  "available",
  "active",
  "in-progress",
  "completed",
]);

const DEFAULT_STATUS_LABELS: Record<TileCardState, string> = {
  locked: "Locked",
  available: "Open",
  active: "Current",
  "in-progress": "In progress",
  completed: "Done",
  loading: "Loading",
  error: "Not loaded",
};

type StateStyle = {
  Icon: typeof LockClosedIcon;
  /** The card's edge colour and surface. */
  card: string;
  /** The badge's background and text colour. */
  badge: string;
  icon?: string;
};

// Full class names, so Tailwind's content scan finds every one. Each state
// has an icon and a label as well as its colours.
const STATE_STYLES: Record<TileCardState, StateStyle> = {
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

// Matches the `wiggle` and `locked-flash` animations in tailwind.config.ts.
// The fallback clears the feedback if `animationend` never fires (the tab is
// hidden, or animations are off).
const WIGGLE_DURATION_MS = 400;
const WIGGLE_FALLBACK_MS = WIGGLE_DURATION_MS + 200;

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-focus";

type TileCardProps = {
  title: string;
  state: TileCardState;
  /**
   * A picture for the card, such as a `PlaceholderArt` or an image. It is
   * decorative (hidden from assistive technology): anything it says must also
   * be in the title.
   */
  picture: ReactNode;
  /** Where the card goes once it can be opened. */
  href: string;
  /** Marks the card as the next place to go, with a labelled ribbon. */
  isNext?: boolean;
  /** Called when an open card is activated, as it navigates. */
  onActivate?: () => void;
  /** Overrides the badge text per state, for copy that fits the feature. */
  statusLabels?: Partial<Record<TileCardState, string>>;
  /** The ribbon text on the next card. */
  nextLabel?: string;
  /** Announced when a locked card is tapped. */
  lockedMessage?: string;
  /** Layout only. */
  className?: string;
};

// A big tappable card with a picture, a title, and a status badge. Open states
// are links (Enter, as for any link, and Space too). Locked, loading, and error
// cards stay visible and focusable but never navigate: like SubmitButton while
// pending, they use aria-disabled instead of being removed from the tab order.
// A tap on a locked card answers with a small wiggle and a spoken message.
export function TileCard({
  title,
  state,
  picture,
  href,
  isNext = false,
  onActivate,
  statusLabels,
  nextLabel = "Next",
  lockedMessage = `${title} is locked for now.`,
  className,
}: TileCardProps) {
  const [lockedTaps, setLockedTaps] = useState(0);
  const [isWiggling, setIsWiggling] = useState(false);
  const faceRef = useRef<HTMLSpanElement>(null);

  // Restarts the feedback on every tap, even one while it is still playing:
  // dropping the animation for one style recalculation (the forced layout)
  // and restoring it starts it again. Remounting the face would do the same,
  // but would also remount the picture, and an image could flicker.
  useLayoutEffect(() => {
    const element = faceRef.current;
    if (lockedTaps === 0 || element === null) {
      return;
    }
    element.style.animation = "none";
    void element.offsetWidth;
    element.style.animation = "";
  }, [lockedTaps]);

  useEffect(() => {
    if (!isWiggling) {
      return;
    }
    const timer = window.setTimeout(
      () => setIsWiggling(false),
      WIGGLE_FALLBACK_MS,
    );
    return () => window.clearTimeout(timer);
  }, [isWiggling, lockedTaps]);

  const statusLabel = statusLabels?.[state] ?? DEFAULT_STATUS_LABELS[state];
  const accessibleName = [title, statusLabel, isNext ? nextLabel : null]
    .filter(Boolean)
    .join(", ");
  const isOpen = OPEN_STATES.has(state);

  function handleClosedActivate() {
    if (state !== "locked") {
      return;
    }
    setLockedTaps((taps) => taps + 1);
    setIsWiggling(true);
  }

  // Links answer Enter natively but not Space, which would scroll the page.
  // A held Enter repeats the native activation, so its repeats are cancelled.
  function handleOpenKeyDown(event: KeyboardEvent<HTMLAnchorElement>) {
    if (event.key === "Enter") {
      if (event.repeat) {
        event.preventDefault();
      }
      return;
    }
    if (event.key !== " ") {
      return;
    }
    event.preventDefault();
    if (!event.repeat) {
      event.currentTarget.click();
    }
  }

  function handleClosedKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    if (!event.repeat) {
      handleClosedActivate();
    }
  }

  // Ignores animations that end inside the card, such as a picture's.
  function handleAnimationEnd(event: AnimationEvent<HTMLSpanElement>) {
    if (event.target === event.currentTarget) {
      setIsWiggling(false);
    }
  }

  const face = (
    <CardFace
      ref={faceRef}
      title={title}
      state={state}
      picture={picture}
      statusLabel={statusLabel}
      nextLabel={isNext ? nextLabel : null}
      isWiggling={isWiggling}
      onAnimationEnd={handleAnimationEnd}
    />
  );

  return (
    <div className={cn("flex w-full min-w-0 flex-col", className)}>
      {isOpen ? (
        <Link
          href={href}
          aria-label={accessibleName}
          onClick={onActivate ? () => onActivate() : undefined}
          onKeyDown={handleOpenKeyDown}
          className={cn("group flex flex-1 flex-col rounded-tile", FOCUS_RING)}
        >
          {face}
        </Link>
      ) : (
        <span
          role="link"
          tabIndex={0}
          aria-disabled="true"
          aria-label={accessibleName}
          onClick={handleClosedActivate}
          onKeyDown={handleClosedKeyDown}
          className={cn("flex flex-1 flex-col rounded-tile", FOCUS_RING)}
        >
          {face}
        </span>
      )}
      {/* Always mounted, so screen readers are already watching it. Each tap
          inserts a new node, which announces a repeated message again. */}
      <span role="status" className="sr-only">
        {lockedTaps > 0 ? <span key={lockedTaps}>{lockedMessage}</span> : null}
      </span>
    </div>
  );
}

type CardFaceProps = {
  ref: Ref<HTMLSpanElement>;
  title: string;
  state: TileCardState;
  picture: ReactNode;
  statusLabel: string;
  nextLabel: string | null;
  isWiggling: boolean;
  onAnimationEnd: (event: AnimationEvent<HTMLSpanElement>) => void;
};

// What the card looks like. Spans throughout: the card may be a <span>, which
// only takes phrasing content.
function CardFace({
  ref,
  title,
  state,
  picture,
  statusLabel,
  nextLabel,
  isWiggling,
  onAnimationEnd,
}: CardFaceProps) {
  const { Icon, card, badge, icon } = STATE_STYLES[state];
  const isNext = nextLabel !== null;

  return (
    <span
      ref={ref}
      // Marks the locked feedback while it plays, for tests and tooling.
      data-feedback={isWiggling ? "wiggle" : undefined}
      onAnimationEnd={onAnimationEnd}
      className={cn(
        "relative flex flex-1 flex-col overflow-hidden rounded-tile shadow-sm",
        card,
        // The next card's edge is thicker and in the "next" colour. Focus is
        // an outline outside the card, so the two never look alike.
        isNext ? "border-4 border-next-edge" : "border-2",
        OPEN_STATES.has(state) ? "group-hover:shadow-lg" : undefined,
        isWiggling
          ? "motion-safe:animate-wiggle motion-reduce:animate-locked-flash"
          : undefined,
      )}
    >
      <span aria-hidden="true" className="block aspect-tile w-full">
        <span
          className={cn(
            "block size-full",
            state === "locked" ? "grayscale" : undefined,
          )}
        >
          {picture}
        </span>
      </span>
      <span className="flex flex-1 flex-col items-start gap-2 p-3">
        <span className="self-stretch break-words text-lg font-bold leading-snug text-ink">
          {title}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-badge px-2.5 py-1 text-sm font-semibold",
            badge,
          )}
        >
          <Icon aria-hidden="true" className={cn("size-5 shrink-0", icon)} />
          {statusLabel}
        </span>
      </span>
      {isNext ? (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-badge bg-next px-2.5 py-1 text-sm font-bold text-next-ink shadow-sm">
          <StarIcon aria-hidden="true" className="size-5 shrink-0" />
          {nextLabel}
        </span>
      ) : null}
    </span>
  );
}
