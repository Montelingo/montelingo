import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SMALL_LINK } from "@/components/ui/kid-styles";
import { signInHref, SignOutButton } from "@/features/auth";
import { getCurrentUser } from "@/features/auth/server";
import { GrownUpsGate } from "@/features/grown-ups";
import { GROWN_UPS_PATH, GrownUpsArea, ME_PATH } from "@/features/map";
import { loadGrownUps } from "@/features/map/server";
import { PRIVACY_PATH } from "@/features/privacy/edge";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Za roditelje",
};

// The grown-ups area: the gate first on every load (#177), then the child's
// progress and the account (#178). "Odjavi se" signs out at once until #179
// asks first. It links to the privacy policy (#255).
export default async function GrownUpsPage() {
  // The same call as play/layout.tsx's on a full load. The layout does not
  // run again on a client-side visit, when the session may have ended.
  const user = await getCurrentUser();
  if (user === null) {
    redirect(signInHref(GROWN_UPS_PATH));
  }
  const data = await loadGrownUps();

  return (
    <GrownUpsGate closeHref={ME_PATH}>
      <GrownUpsArea
        {...data}
        email={user.email}
        signOut={<SignOutButton appearance="grown-ups" />}
      >
        <Link href={PRIVACY_PATH} className={cn(SMALL_LINK, "self-start")}>
          Politika privatnosti
        </Link>
      </GrownUpsArea>
    </GrownUpsGate>
  );
}
