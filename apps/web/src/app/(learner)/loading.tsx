"use client";

import { usePathname } from "next/navigation";

import { LearnerPageSkeleton } from "@/features/learner";
import {
  LocationScreenSkeleton,
  MapHomeSkeleton,
  RegionScreenSkeleton,
} from "@/features/map";
import { PlayersScreenSkeleton } from "@/features/profile";

import { learnerSkeletonFor } from "./learner-skeleton";

// Shown inside the learner chrome during the session check in
// play/layout.tsx, before any page's own loading.tsx can show. It shows the
// skeleton that page's loading.tsx will show, picked from the URL, so a full
// load goes from one skeleton straight to the page instead of flashing a
// neutral one first. A client component only to read the URL.
export default function LearnerLoading() {
  switch (learnerSkeletonFor(usePathname())) {
    case "map":
      return <MapHomeSkeleton />;
    case "region":
      return <RegionScreenSkeleton />;
    case "location":
      return <LocationScreenSkeleton />;
    case "players":
      return <PlayersScreenSkeleton />;
    case "page":
      return <LearnerPageSkeleton />;
  }
}
