"use client";

import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { backHref, type BackTargets } from "../model/paths";
import { controlClassName } from "./control-class-name";

type BackControlProps = BackTargets;

// Goes one level up the URL (a lesson → its chapter → its place → its region
// → the map), skipping levels that have no screen, and from the map out of
// the area, so adults can reach the rest of the site.
export function BackControl({
  homeHref,
  exitHref,
  screenlessDepths,
}: BackControlProps) {
  const pathname = usePathname();

  return (
    <Link
      href={backHref(pathname, { homeHref, exitHref, screenlessDepths })}
      aria-label="Back"
      className={controlClassName}
    >
      <ArrowLeftIcon aria-hidden="true" className="size-8" />
    </Link>
  );
}
