import "server-only";

import { getAuthState } from "@/features/auth/server";
import { toExplorer } from "@/features/profile/edge";
import { getProfileResult } from "@/features/profile/server";

import type { HomeView } from "../model/home-view";

/**
 * Decides which home the page shows, from the session and the child profile.
 * Never throws for a failed lookup: an unknown account is a visitor who may
 * sign out, and an unreadable profile shows the placeholder explorer.
 */
export async function loadHomeView(): Promise<HomeView> {
  const auth = await getAuthState();
  if (auth.status !== "signed-in") {
    return { status: "visitor", canSignOut: auth.status === "unavailable" };
  }
  const profile = await getProfileResult();
  switch (profile.status) {
    case "signed-out":
      // The session ended between the two calls.
      return { status: "visitor", canSignOut: false };
    case "unavailable":
      return { status: "family", explorer: null };
    case "ready":
      return { status: "family", explorer: toExplorer(profile.profile) };
  }
}
