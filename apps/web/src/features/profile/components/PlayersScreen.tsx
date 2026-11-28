"use client";

import Image from "next/image";
import Link from "next/link";

import { FOCUS_RING, ICON_BUTTON } from "@/components/ui/kid-styles";
import { cn } from "@/lib/cn";
import { fredoka } from "@/lib/fonts";

import { useSwitchPlayer } from "../hooks/use-switch-player";
import { type Player, playerLook } from "../model/players";
import { avatarSrc } from "../model/profile";

type PlayersScreenProps = {
  players: readonly Player[];
  /** Where Back goes: the Ja tab. */
  backHref: string;
};

const FAILED_MESSAGE = "Promjena nije uspjela. Pokušaj ponovo.";

// "Ko igra?" (Figma TB2 "Who's playing?", #184): a card per player, with
// their buddy and name, on the sky page. Choosing one makes them the active
// player and opens the map with their progress. Adding a player is the
// grown-ups' (#183), so the picker has no Add card. `data-full-screen` drops
// LearnerShell's Back and Home bar: Back is here, and goes to the Ja tab.
export function PlayersScreen({ players, backHref }: PlayersScreenProps) {
  const { status, switchTo } = useSwitchPlayer();
  const isSwitching = status === "switching";

  return (
    <div
      data-full-screen
      className={cn(
        fredoka.className,
        "fixed inset-0 overflow-y-auto bg-kid-sea-soft",
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 pb-safe-b pt-safe-t sm:px-gutter">
        <div className="flex w-full">
          <Link href={backHref} aria-label="Nazad" className={ICON_BUTTON}>
            <Image
              src="/learner/icon-back.svg"
              alt=""
              width={28}
              height={28}
              unoptimized
            />
          </Link>
        </div>
        <h1 className="mt-6 text-center text-4xl font-bold leading-tight text-kid-ink sm:mt-16 sm:text-5xl">
          Ko igra?
        </h1>
        <ul className="flex flex-wrap justify-center gap-x-7 gap-y-5">
          {players.map((player) => {
            const { name, avatar } = playerLook(player);
            return (
              // A flex box, so its card stretches to the row: all as tall.
              <li key={player.id} className="flex">
                <button
                  type="button"
                  aria-disabled={isSwitching}
                  onClick={() => switchTo(player.id)}
                  className={cn(
                    "flex w-36 flex-col items-center gap-2 rounded-kid-lg border-3 border-kid-ink px-2 py-4 text-kid-ink shadow-raised-6",
                    player.isActive ? "bg-kid-yellow-soft" : "bg-white",
                    FOCUS_RING,
                  )}
                >
                  <Image
                    src={avatarSrc(avatar)}
                    alt=""
                    width={96}
                    height={96}
                    unoptimized
                  />
                  <span className="max-w-full truncate text-3xl font-semibold leading-tight">
                    {name}
                  </span>
                  {player.isActive ? (
                    <span className="text-base font-semibold text-kid-muted">
                      sada igra
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
        {/* Always mounted, so a failure is announced when it appears. */}
        <p
          role="status"
          className="min-h-touch text-center text-lg font-semibold text-kid-ink"
        >
          {status === "failed" ? FAILED_MESSAGE : ""}
        </p>
      </div>
    </div>
  );
}
