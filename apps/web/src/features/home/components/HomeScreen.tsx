import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  ACCOUNT_PATH,
  PLAY_PATH,
  SIGN_IN_PATH,
  SIGN_UP_PATH,
} from "@/features/auth/edge";
import { WelcomeFrame } from "@/features/learner";
import {
  avatarSrc,
  type Explorer,
  PLACEHOLDER_EXPLORER_NAME,
} from "@/features/profile/edge";

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-focus";
// Figma's wide buttons with the raised ink edge: yellow for the main action,
// white for the other.
const BIG_BUTTON = `flex h-touch-xl w-full items-center justify-center rounded-kid-lg border-3 border-kid-ink text-2xl font-semibold text-kid-ink shadow-raised-4 ${FOCUS_RING}`;
/** The grown-up's small links: the account, and signing out. */
export const SMALL_LINK = `inline-flex h-touch items-center rounded-kid px-3 text-lg font-semibold text-kid-ink underline underline-offset-4 ${FOCUS_RING}`;

/** Which home the page shows (§6: one state per case). */
export type HomeView =
  /**
   * A visitor. `signOut` is offered only when the account could not be looked
   * up while a session cookie may still be live (a shared tablet), as the
   * site header does; otherwise `null`.
   */
  | { status: "visitor"; signOut: ReactNode | null }
  /** A signed-in family: the child (`null` before setup), and signing out. */
  | { status: "family"; explorer: Explorer | null; signOut: ReactNode };

type HomeScreenProps = {
  /** The picture on the left: the map's art, from the page. */
  art: ReactNode;
  view: HomeView;
};

// The home page, / (#152, Figma "1 · Welcome & Auth"): the welcome for a
// visitor, with sign-up and sign-in, or for a signed-in family the child and
// the way back to the map, with the grown-up's account and signing out. Back
// on the map leads here, so a signed-in family is never sent on to /play.
// The sign-out control is auth's, passed in by the page, styled with
// SMALL_LINK.
export function HomeScreen({ art, view }: HomeScreenProps) {
  return (
    <main id="main-content">
      <WelcomeFrame art={art}>
        {/* The heading sits about a quarter down, as in Figma, and the
            buttons at the bottom of the panel. */}
        <div className="flex flex-1 flex-col gap-6 pt-[12vh]">
          {view.status === "visitor" ? (
            <SignedOut signOut={view.signOut} />
          ) : (
            <SignedIn explorer={view.explorer} signOut={view.signOut} />
          )}
        </div>
      </WelcomeFrame>
    </main>
  );
}

function SignedOut({ signOut }: { signOut: ReactNode }) {
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
        <Link href={SIGN_UP_PATH} className={`${BIG_BUTTON} bg-kid-yellow`}>
          Nov sam
        </Link>
        <Link href={SIGN_IN_PATH} className={`${BIG_BUTTON} bg-white`}>
          Imam nalog
        </Link>
        {signOut !== null ? (
          <div className="flex justify-center">{signOut}</div>
        ) : null}
      </div>
    </>
  );
}

function SignedIn({
  explorer,
  signOut,
}: {
  explorer: Explorer | null;
  signOut: ReactNode;
}) {
  return (
    <>
      <h1 className="text-4xl font-semibold text-kid-ink">
        Dobro došli nazad!
      </h1>
      <div className="flex items-center gap-4 rounded-kid-lg border-3 border-kid-ink bg-white p-4 shadow-raised-4">
        <Image
          src={avatarSrc(explorer?.avatar ?? "fox")}
          alt=""
          width={72}
          height={72}
          unoptimized
          className="shrink-0"
        />
        <span className="flex min-w-0 flex-col">
          <span className="break-words text-3xl font-semibold text-kid-ink">
            {explorer?.name ?? PLACEHOLDER_EXPLORER_NAME}
          </span>
          {explorer !== null ? (
            <span className="text-base font-medium text-kid-muted">
              {explorer.title}
            </span>
          ) : null}
        </span>
      </div>
      <div className="mt-auto flex flex-col gap-4">
        <Link href={PLAY_PATH} className={`${BIG_BUTTON} bg-kid-yellow`}>
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
