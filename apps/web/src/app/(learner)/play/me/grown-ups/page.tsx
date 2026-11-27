import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SMALL_LINK } from "@/components/ui/kid-styles";
import { signInHref, SignOutConfirm } from "@/features/auth";
import { getCurrentUser } from "@/features/auth/server";
import { GrownUpsGate } from "@/features/grown-ups";
import { GROWN_UPS_PATH, GrownUpsArea, MapArt, ME_PATH } from "@/features/map";
import { loadGrownUps } from "@/features/map/server";
import { PRIVACY_PATH } from "@/features/privacy/edge";
import { PlayersCard } from "@/features/profile";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Za roditelje",
};

// The grown-ups area: the gate first on every load (#177), then the child's
// progress and the account (#178), and the players, with Add player (#183).
// "Odjavi se" asks first, then signs out to the welcome screen (#179). It
// links to the privacy policy (#255).
export default async function GrownUpsPage() {
  // The same call as play/layout.tsx's on a full load. The layout does not
  // run again on a client-side visit, when the session may have ended.
  const user = await getCurrentUser();
  if (user === null) {
    redirect(signInHref(GROWN_UPS_PATH));
  }
  const { players, ...data } = await loadGrownUps();

  return (
    <GrownUpsGate closeHref={ME_PATH}>
      <GrownUpsArea
        {...data}
        email={user.email}
        playersCard={
          players === null ? null : (
            <PlayersCard players={players} art={<MapArt />} />
          )
        }
        signOut={<SignOutConfirm email={user.email} />}
      >
        <Link href={PRIVACY_PATH} className={cn(SMALL_LINK, "self-start")}>
          Politika privatnosti
        </Link>
      </GrownUpsArea>
    </GrownUpsGate>
  );
}
