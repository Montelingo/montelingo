import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { BIG_BUTTON, SMALL_LINK } from "@/components/ui/kid-styles";
import {
  ACCOUNT_PATH,
  PLAY_PATH,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
} from "@/features/auth/edge";
import {
  avatarSrc,
  type Explorer,
  PLACEHOLDER_EXPLORER,
} from "@/features/profile/edge";
import { cn } from "@/lib/cn";

import type { HomeView } from "../model/home-view";

type HomeScreenProps = {
  view: HomeView;
  /**
   * Auth's sign-out control, from the page (`<SignOutButton
   * appearance="welcome" />`), shown where the view allows it.
   */
  signOut: ReactNode;
};

// The home page's panel, / (#152, Figma "1 · Welcome & Auth"): the welcome for
// a visitor, with sign-up and sign-in, or for a signed-in family the child and
// the way back to the map, with the grown-up's account and signing out. Back
// on the map leads here, so a signed-in family is never sent on to /play. The
// welcome frame around it is the (welcome) layout's.
export function HomeScreen({ view, signOut }: HomeScreenProps) {
  return (
    // The heading sits about a quarter down, as in Figma, and the buttons at
    // the bottom of the panel.
    <div className="flex flex-1 flex-col gap-6 pt-12 lg:pt-24">
      {view.status === "visitor" ? (
        <SignedOut signOut={view.canSignOut ? signOut : null} />
      ) : (
        <SignedIn explorer={view.explorer} signOut={signOut} />
      )}
    </div>
  );
}

type SignedOutProps = {
  /** The sign-out control, or `null` when a visitor has nothing to end. */
  signOut: ReactNode;
};

function SignedOut({ signOut }: SignedOutProps) {
  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold text-kid-ink">
          Istraži Crnu Goru, riječ po riječ
        </h1>
        <p className="text-xl font-medium text-kid-muted">
          Priče, zvuci i naljepnice za uzrast 3–7. Odrasla osoba prvo sve
          podesi.
        </p>
      </div>
      <div className="mt-auto flex flex-col gap-4">
        <Link href={SIGN_UP_PATH} className={cn(BIG_BUTTON, "bg-kid-yellow")}>
          Nov sam
        </Link>
        <Link href={SIGN_IN_PATH} className={cn(BIG_BUTTON, "bg-white")}>
          Imam nalog
        </Link>
        {signOut !== null ? (
          <div className="flex justify-center">{signOut}</div>
        ) : null}
      </div>
    </>
  );
}

type SignedInProps = {
  /** The child, or `null` when the profile could not be read. */
  explorer: Explorer | null;
  signOut: ReactNode;
};

function SignedIn({ explorer, signOut }: SignedInProps) {
  const shown = explorer ?? PLACEHOLDER_EXPLORER;
  return (
    <>
      <h1 className="text-4xl font-semibold text-kid-ink">
        Dobro došli nazad!
      </h1>
      <div className="flex items-center gap-4 rounded-kid-lg border-3 border-kid-ink bg-white p-4 shadow-raised-4">
        <Image
          src={avatarSrc(shown.avatar)}
          alt=""
          width={72}
          height={72}
          unoptimized
          className="shrink-0"
        />
        <span className="flex min-w-0 flex-col">
          <span className="break-words text-3xl font-semibold text-kid-ink">
            {shown.name}
          </span>
          {explorer !== null ? (
            <span className="text-base font-medium text-kid-muted">
              {explorer.title}
            </span>
          ) : null}
        </span>
      </div>
      <div className="mt-auto flex flex-col gap-4">
        <Link href={PLAY_PATH} className={cn(BIG_BUTTON, "bg-kid-yellow")}>
          Nastavi istraživanje
        </Link>
        <div className="flex items-center justify-center gap-4">
          <Link href={ACCOUNT_PATH} className={SMALL_LINK}>
            Nalog
          </Link>
          {signOut}
        </div>
      </div>
    </>
  );
}
