import Link from "next/link";

import { FOCUS_RING } from "@/components/ui/kid-styles";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import { CONTENT_LANG } from "../model/content";

type ScreenHeaderProps = {
  /** The heading's id, which names the screen. */
  titleId: string;
  title: string;
  /** What the screen is in: a place's region, a chapter's place. */
  parent: { name: string; href: string };
};

// The head of a place's or a chapter's screen: its name, then "In" and a link
// to what it is in. Both names are Montenegrin, so they carry its `lang`; the
// English around them does not.
export function ScreenHeader({ titleId, title, parent }: ScreenHeaderProps) {
  return (
    <div className={cn(fredoka.className, "flex flex-col")}>
      <h1
        id={titleId}
        lang={CONTENT_LANG}
        className="break-words text-4xl font-semibold text-kid-ink"
      >
        {title}
      </h1>
      <p className="flex flex-wrap items-center gap-x-1.5 text-lg text-kid-muted">
        In
        {/* As tall as a touch target, though it reads as a line of text. */}
        <Link
          href={parent.href}
          lang={CONTENT_LANG}
          className={cn(
            "inline-flex min-h-touch items-center rounded-md font-semibold text-kid-ink underline underline-offset-4 hover:no-underline",
            FOCUS_RING,
          )}
        >
          {parent.name}
        </Link>
      </p>
    </div>
  );
}
