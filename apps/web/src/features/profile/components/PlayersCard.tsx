"use client";

import Image from "next/image";
import { type ReactNode, useId, useRef, useState } from "react";

import { FOCUS_RING, GROWN_UPS_CARD } from "@/components/ui/kid-styles";
import { cn } from "@/lib/cn";
import { useNavigate } from "@/lib/use-navigate";

import { canAddPlayer, type Player, playerLook } from "../model/players";
import { avatarSrc } from "../model/profile";
import { AddPlayer } from "./AddPlayer";

type PlayersCardProps = {
  /** The account's players, oldest first. */
  players: readonly Player[];
  /** The picture beside Add player's steps: the map's art, from the page. */
  art: ReactNode;
};

// The grown-ups area's "Igrači" card (#183, Figma Me3 "Players"): each
// player's buddy and name, then a dashed "Dodaj" circle while the account has
// fewer than four. Dodaj runs the setup steps for a new player (AddPlayer).
// Once anything was sent, the page's data is loaded again (router refresh),
// since the new player is now the active one, so the progress card and this
// list both change; the gate stays passed, as it lives in the page's state.
export function PlayersCard({ players, art }: PlayersCardProps) {
  const router = useNavigate();
  const headingId = useId();
  const [isAdding, setIsAdding] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  function handleClosed(changed: boolean) {
    setIsAdding(false);
    if (changed) {
      router.refresh();
      // Dodaj may be gone once the list is full: the card's heading is not.
      headingRef.current?.focus();
    } else {
      addRef.current?.focus();
    }
  }

  return (
    <section aria-labelledby={headingId} className={GROWN_UPS_CARD}>
      <h2
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-semibold leading-tight text-kid-ink outline-none"
      >
        Igrači
      </h2>
      <ul className="flex flex-wrap gap-3">
        {players.map((player) => {
          const { name, avatar } = playerLook(player);
          return (
            <li
              key={player.id}
              className="flex w-16 flex-col items-center gap-0.5"
            >
              <Image
                src={avatarSrc(avatar)}
                alt=""
                aria-hidden="true"
                width={53}
                height={53}
                // Local SVGs need no resizing (see the map's ChromeIcon).
                unoptimized
              />
              <span className="max-w-full truncate text-base font-semibold leading-tight text-kid-ink">
                {name}
              </span>
            </li>
          );
        })}
        {canAddPlayer(players) ? (
          <li className="flex">
            <button
              ref={addRef}
              type="button"
              aria-haspopup="dialog"
              aria-label="Dodaj igrača"
              onClick={() => setIsAdding(true)}
              className={cn(
                "flex w-16 flex-col items-center gap-0.5 rounded-kid",
                FOCUS_RING,
              )}
            >
              <span className="flex size-[53px] items-center justify-center rounded-full border-[2.5px] border-dashed border-kid-ink">
                <Image
                  src="/learner/icon-plus.svg"
                  alt=""
                  aria-hidden="true"
                  width={24}
                  height={24}
                  unoptimized
                />
              </span>
              <span className="text-base font-semibold leading-tight text-kid-muted">
                Dodaj
              </span>
            </button>
          </li>
        ) : null}
      </ul>
      {isAdding ? <AddPlayer art={art} onClose={handleClosed} /> : null}
    </section>
  );
}
