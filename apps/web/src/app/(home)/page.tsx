import type { Metadata } from "next";

import { SignOutButton } from "@/features/auth";
import { getAuthState } from "@/features/auth/server";
import { HomeScreen, type HomeView, SMALL_LINK } from "@/features/home";
import { MapArt } from "@/features/map";
import { toExplorer } from "@/features/profile/edge";
import { readProfile } from "@/features/profile/server";

export const metadata: Metadata = {
  title: "Montelingo",
};

function HomeSignOutButton() {
  return (
    <SignOutButton
      label="Odjavi se"
      pendingLabel="Odjavljujem…"
      className={SMALL_LINK}
      alertClassName="mt-2"
      failureMessage="Odjava nije potvrđena. Pokušaj ponovo."
    />
  );
}

// The home page (#152): the welcome for a visitor, or the family's way back
// to the map. Outside the (site) layout, so it has no site header: the screen
// is the Figma welcome, full screen.
export default async function HomePage() {
  return <HomeScreen art={<MapArt />} view={await homeView()} />;
}

async function homeView(): Promise<HomeView> {
  const auth = await getAuthState();
  if (auth.status !== "signed-in") {
    // A failed lookup may hide a live session, so it offers signing out, as
    // the site header does.
    return {
      status: "visitor",
      signOut: auth.status === "unavailable" ? <HomeSignOutButton /> : null,
    };
  }
  const profile = await readProfile();
  switch (profile.status) {
    case "signed-out":
      // The session ended between the two calls.
      return { status: "visitor", signOut: null };
    case "unavailable":
      return {
        status: "family",
        explorer: null,
        signOut: <HomeSignOutButton />,
      };
    case "ready":
      return {
        status: "family",
        explorer: toExplorer(profile.profile),
        signOut: <HomeSignOutButton />,
      };
  }
}
