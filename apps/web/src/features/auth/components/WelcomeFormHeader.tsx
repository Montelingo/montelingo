import Image from "next/image";
import Link from "next/link";

import { ICON_BUTTON } from "@/components/ui/kid-styles";

import { HOME_PATH } from "../model/routes";

type WelcomeFormHeaderProps = {
  /** The heading's id, which names the form. */
  titleId: string;
  title: string;
  /** The line under the heading. */
  lead: string;
  /** Shows the "Za odrasle" chip: the screen is for the grown-up. */
  forGrownUps?: boolean;
};

// The top of the sign-in and sign-up panels (Figma "1 · Welcome & Auth"): the
// round Back button to the welcome, the chip, the heading and its line.
export function WelcomeFormHeader({
  titleId,
  title,
  lead,
  forGrownUps = false,
}: WelcomeFormHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Back and the chip share a row, so the form fits a landscape tablet
          even with every field in error. */}
      <div className="flex items-center gap-4">
        <Link href={HOME_PATH} aria-label="Nazad" className={ICON_BUTTON}>
          <Image
            src="/learner/icon-back.svg"
            alt=""
            width={28}
            height={28}
            unoptimized
          />
        </Link>
        {forGrownUps ? (
          <p className="rounded-full border-3 border-kid-ink bg-kid-yellow-soft px-3 py-0.5 text-base font-semibold text-kid-ink">
            Za odrasle
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        <h1 id={titleId} className="text-4xl font-semibold text-kid-ink">
          {title}
        </h1>
        <p className="text-lg font-medium text-kid-muted">{lead}</p>
      </div>
    </div>
  );
}
