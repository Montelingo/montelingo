import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useId } from "react";

import { ICON_BUTTON } from "@/components/ui/kid-styles";
import { avatarSrc } from "@/features/profile/edge";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import { CONTENT_LANG } from "../model/content";
import {
  countsText,
  type GrownUpsData,
  type RegionProgress,
} from "../model/grown-ups";
import { ME_PATH } from "../model/paths";
import { ChromeIcon } from "./ChromeIcon";
import { ProgressErrorNotice } from "./ProgressErrorNotice";

type GrownUpsAreaProps = GrownUpsData & {
  /** The account's email, from `auth/me`. */
  email: string;
  /** Auth's sign-out control, from the page: features may not import it. */
  signOut: ReactNode;
  /** Under the cards: the link to the privacy policy. */
  children?: ReactNode;
};

const CARD =
  "flex flex-col gap-2.5 rounded-kid-md border-3 border-kid-ink bg-white px-4 pb-4 pt-3.5";

// The grown-ups area, /play/me/grown-ups (Figma "Me3 · Grown-ups area",
// screen 3 of #174), behind the gate (#177): Back to Ja and the title, the
// child's progress by region, and the account with "Odjavi se". Part A has no
// Players or Settings cards and no "This week" line. A centred column as wide
// as Figma's tablet one (760px), the full width less a 16px gutter on a phone,
// with no bottom nav. `data-map-screen` drops LearnerShell's Back and Home bar.
export function GrownUpsArea({
  explorer,
  regions,
  counts,
  needsRetry,
  email,
  signOut,
  children,
}: GrownUpsAreaProps) {
  const progressId = useId();
  return (
    <div
      data-map-screen
      className={cn(
        fredoka.className,
        "fixed inset-0 overflow-y-auto bg-kid-cream",
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3.5 px-4 pb-10 pt-safe-t sm:px-gutter">
        <header className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2 pt-1">
          <Link href={ME_PATH} aria-label="Nazad" className={ICON_BUTTON}>
            <ChromeIcon name="back" size={28} />
          </Link>
          <h1 className="text-center text-2xl font-semibold leading-tight text-kid-ink">
            Za roditelje
          </h1>
        </header>
        {needsRetry ? (
          <ProgressErrorNotice message="Your child’s progress didn’t load fully. Something went wrong on our side. Let’s try again." />
        ) : null}
        <section aria-labelledby={progressId} className={CARD}>
          <div className="flex items-center gap-2.5">
            <Image
              src={avatarSrc(explorer.avatar)}
              alt=""
              aria-hidden="true"
              width={43}
              height={43}
              // Local SVGs need no resizing (see ChromeIcon).
              unoptimized
            />
            <h2
              id={progressId}
              className="min-w-0 break-words text-2xl font-semibold leading-tight text-kid-ink"
            >
              Napredak: {explorer.name}
            </h2>
          </div>
          <ul className="flex flex-col gap-2.5">
            {regions.map((region) => (
              <RegionRow key={region.id} region={region} />
            ))}
          </ul>
          {counts !== null ? (
            <p className="text-sm font-medium text-kid-muted">
              {countsText(counts)}
            </p>
          ) : null}
        </section>
        <section aria-label="Nalog" className={CARD}>
          <p className="flex items-center gap-2.5 text-xl font-medium text-kid-ink">
            <Image
              src="/learner/icon-mail.svg"
              alt=""
              aria-hidden="true"
              width={22}
              height={22}
              unoptimized
              className="shrink-0"
            />
            <span className="min-w-0 break-all">{email}</span>
          </p>
          {signOut}
        </section>
        {children}
      </div>
    </div>
  );
}

// A region's name, its completed places out of all of them, and a green bar
// of the same. One name for screen readers, as on the map's region pill.
function RegionRow({ region }: { region: RegionProgress }) {
  const { name, completed, total } = region;
  const percent =
    completed === null || total === 0 ? 0 : (completed / total) * 100;
  return (
    <li className="flex">
      <div
        role="group"
        aria-label={
          completed === null
            ? `${name}: nije učitano`
            : `${name}: ${completed} od ${total} mjesta`
        }
        className="flex flex-1 flex-col gap-1"
      >
        <div
          aria-hidden="true"
          className="flex items-start justify-between gap-2 font-semibold leading-tight"
        >
          <span
            lang={CONTENT_LANG}
            className="min-w-0 break-words text-kid-ink"
          >
            {name}
          </span>
          <span className="shrink-0 text-kid-muted">
            {completed ?? "–"}/{total}
          </span>
        </div>
        <div
          aria-hidden="true"
          className="h-2.5 overflow-hidden rounded-full border-[1.5px] border-kid-ink bg-kid-fog"
        >
          <div
            className="h-full rounded-full bg-kid-green"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </li>
  );
}
