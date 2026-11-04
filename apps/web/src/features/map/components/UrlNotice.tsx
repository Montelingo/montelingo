"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  MAP_NOTICES,
  type MapNotice,
  mapNoticeIn,
  withoutMapNotice,
} from "../model/notices";
import { ScreenNotice } from "./ScreenNotice";

type UrlNoticeProps = {
  /** The notice the page read from its `?notice=`. */
  notice: MapNotice;
};

// A notice the page read from its `?notice=`, said once. After it has been
// announced, `?notice=` is dropped from the URL, so a reload does not show it
// again. Next.js keeps `history.replaceState()` in step with its router (the
// URL that `useSearchParams()` returns changes) without fetching the page
// again, so the notice stays on screen until the learner leaves.
//
// Back returns to the screen from the router's cache, which still holds the
// notice, at a URL without it. The notice therefore shows only when the URL
// had it as the screen appeared, which is read once, on mount: the URL the
// page was rendered for, not the one the notice later cleans up.
export function UrlNotice({ notice }: UrlNoticeProps) {
  const searchParams = useSearchParams();
  const [isInUrl] = useState(() => mapNoticeIn(searchParams) === notice);

  if (!isInUrl) {
    return null;
  }
  return (
    <ScreenNotice message={MAP_NOTICES[notice]} onAnnounce={dropUrlNotice} />
  );
}

// Called once the notice has been announced, a moment after mount, never
// from the first commit's effects: on a full load the App Router patches
// `history.replaceState()` in an effect of its own, which runs after its
// children's, and the browser's unpatched one would drop the router's history
// state, breaking Back to this screen.
function dropUrlNotice(): void {
  const path = withoutMapNotice(window.location.href);
  if (path !== null) {
    window.history.replaceState(null, "", path);
  }
}
