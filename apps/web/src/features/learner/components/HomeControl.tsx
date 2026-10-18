"use client";

import { HomeIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isAtPath } from "../model/paths";
import { controlClassName } from "./control-class-name";

type HomeControlProps = {
  /** The top of the learner area (the map). */
  homeHref: string;
};

// Goes to the map from anywhere in the learner area, and says so when already there.
export function HomeControl({ homeHref }: HomeControlProps) {
  const pathname = usePathname();

  return (
    <Link
      href={homeHref}
      aria-label="Home"
      aria-current={isAtPath(pathname, homeHref) ? "page" : undefined}
      className={controlClassName}
    >
      <HomeIcon aria-hidden="true" className="size-8" />
    </Link>
  );
}
