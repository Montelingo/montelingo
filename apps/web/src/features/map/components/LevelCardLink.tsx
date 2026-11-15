"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";

import { openLevelCard } from "./level-card-navigation";

type LevelCardLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

// A link to a place's level card, which opens it as openLevelCard() does. A
// click with a modifier key, or not the main button, is left to the browser
// (a new tab or window).
export function LevelCardLink({ href, onClick, ...props }: LevelCardLinkProps) {
  const router = useRouter();
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    openLevelCard(href, router);
  }
  return <Link href={href} onClick={handleClick} {...props} />;
}
