import type { Metadata } from "next";

import { SignOutButton } from "@/features/auth";
import { HomeScreen } from "@/features/home";
import { loadHomeView } from "@/features/home/server";

export const metadata: Metadata = {
  title: "Montelingo",
};

// The home page (#152): the welcome for a visitor, or the family's way back
// to the map. In the (welcome) layout, so it has no site header: the screen is
// the Figma welcome, full screen.
export default async function HomePage() {
  return (
    <HomeScreen
      view={await loadHomeView()}
      signOut={<SignOutButton appearance="welcome" />}
    />
  );
}
