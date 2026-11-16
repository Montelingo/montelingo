import { ApiClientError } from "@app/api-client";
import type { Metadata } from "next";

import { SignOutButton } from "@/features/auth";
import { getAuthState } from "@/features/auth/server";
import { HomeScreen, SMALL_LINK } from "@/features/home";
import { MapArt } from "@/features/map";
import { type Profile, toExplorer } from "@/features/profile/edge";
import { getProfile } from "@/features/profile/server";

export const metadata: Metadata = {
  title: "Montelingo",
};

function signOutControl() {
  return (
    <SignOutButton
      label="Odjavi se"
      pendingLabel="Odjavljujem…"
      className={SMALL_LINK}
      alertClassName="mt-2"
    />
  );
}

// The home page (#152): the welcome for a visitor, or the family's way back
// to the map. Outside the (site) layout, so it has no site header: the screen
// is the Figma welcome, full screen. When the account cannot be looked up,
// the welcome shows with signing out too, as the site header does then, since
// a live session may be behind it.
export default async function HomePage() {
  const auth = await getAuthState();
  if (auth.status !== "signed-in") {
    return (
      <HomeScreen
        art={<MapArt />}
        family={null}
        visitorSignOut={auth.status === "unavailable" ? signOutControl() : null}
      />
    );
  }

  // getProfile() returns null for any failure but a 401, which means the
  // session ended between the two calls: the visitor's welcome, then.
  let profile: Profile | null;
  try {
    profile = await getProfile();
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      return <HomeScreen art={<MapArt />} family={null} />;
    }
    throw error;
  }
  return (
    <HomeScreen
      art={<MapArt />}
      family={{
        explorer: profile === null ? null : toExplorer(profile),
        signOut: signOutControl(),
      }}
    />
  );
}
