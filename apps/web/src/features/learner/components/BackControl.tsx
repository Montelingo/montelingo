"use client";

import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { backHref } from "../model/paths";
import { controlClassName } from "./control-class-name";

type BackControlProps = {
  /** The top of the learner area (the map). */
  homeHref: string;
  /** Where Back leads from the top of the area, out of it. */
  exitHref: string;
};

// Goes one level up the URL (a place → its region → the map), and from the map
// out of the area, so adults can reach the rest of the site.
export function BackControl({ homeHref, exitHref }: BackControlProps) {
  const pathname = usePathname();

  return (
    <Link
      href={backHref(pathname, { homeHref, exitHref })}
      aria-label="Back"
      className={controlClassName}
    >
      <ArrowLeftIcon aria-hidden="true" className="size-8" />
    </Link>
  );
}
