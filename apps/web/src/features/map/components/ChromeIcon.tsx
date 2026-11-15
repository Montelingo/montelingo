import Image from "next/image";

import { cn } from "@/lib/cn";

const ICONS = {
  back: "/learner/icon-back.svg",
  sound: "/learner/icon-sound.svg",
  star: "/learner/icon-star.svg",
  heart: "/learner/icon-heart.svg",
  map: "/learner/icon-map.svg",
  "region-map": "/learner/icon-region-map.svg",
  lock: "/learner/icon-lock.svg",
  play: "/learner/icon-play.svg",
  words: "/learner/icon-words.svg",
  prizes: "/learner/icon-prizes.svg",
  me: "/learner/icon-me.svg",
  avatar: "/learner/avatar-fox.svg",
} as const;

export type ChromeIconName = keyof typeof ICONS;

type ChromeIconProps = {
  name: ChromeIconName;
  /** Rendered size in CSS px; the SVGs are the designers' exports. */
  size: number;
  className?: string;
};

// An icon from the designers' Figma kit (public/learner). Always decorative:
// the control around it carries the name.
export function ChromeIcon({ name, size, className }: ChromeIconProps) {
  return (
    <Image
      src={ICONS[name]}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      // Local SVGs need no resizing, and the image optimizer does not take
      // SVG without dangerouslyAllowSVG.
      unoptimized
      className={cn("shrink-0", className)}
    />
  );
}
