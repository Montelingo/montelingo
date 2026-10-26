import { type ReactNode, useId } from "react";

import { MAP_NOTICES, type MapNotice } from "../model/notices";
import { ProgressErrorNotice } from "./ProgressErrorNotice";
import { ScreenNotice } from "./ScreenNotice";

type PickerScreenProps = {
  title: string;
  subtitle: string;
  /** Why the learner was sent here, from the page's `?notice=`. */
  notice: MapNotice | null;
  /** Whether a place has no state from the server yet, which offers a retry. */
  needsProgressRetry: boolean;
  /** The cards to pick from. */
  children: ReactNode;
};

// The frame MapHome and RegionScreen share: a section named by its heading,
// then any notice, then the cards. PickerScreenSkeleton mirrors it.
export function PickerScreen({
  title,
  subtitle,
  notice,
  needsProgressRetry,
  children,
}: PickerScreenProps) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 id={titleId} className="text-3xl font-bold text-ink">
          {title}
        </h1>
        <p className="text-lg text-ink-muted">{subtitle}</p>
      </div>
      {notice !== null ? (
        <ScreenNotice key={notice} message={MAP_NOTICES[notice]} />
      ) : null}
      {needsProgressRetry ? <ProgressErrorNotice /> : null}
      {children}
    </section>
  );
}
