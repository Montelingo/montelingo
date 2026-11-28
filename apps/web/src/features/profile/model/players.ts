import type { Schemas } from "@app/api-client";

import {
  type Avatar,
  PLACEHOLDER_EXPLORER,
  type Profile,
  toProfile,
} from "./profile";

// The account's players (ADR 0007): a player is a learning profile, with its
// id and whether this session plays as it. Switch player (#184) lists them on
// "Ko igra?" and makes the chosen one active.

/** The "Ko igra?" screen, where a child picks who plays (Figma TB2). */
export const PLAYERS_PATH = "/play/me/players";

export type Player = Profile & {
  id: string;
  /** Whether this session plays as them; exactly one player is. */
  isActive: boolean;
};

export function toPlayer(player: Schemas["Player"]): Player {
  return { ...toProfile(player), id: player.id, isActive: player.is_active };
}

/** At most this many players per account (ADR 0007); the API refuses more. */
export const PLAYERS_LIMIT = 4;

/** Whether the grown-ups area offers Add (#183): fewer than the limit. */
export function canAddPlayer(players: readonly Player[]): boolean {
  return players.length < PLAYERS_LIMIT;
}

/** Whether there is anyone to switch to: two players or more. */
export function canSwitchPlayer(players: readonly Player[]): boolean {
  return players.length >= 2;
}

/**
 * How the picker draws a player: their name and buddy, or the placeholder
 * explorer's for one whose setup is not finished yet.
 */
export function playerLook(player: Player): { name: string; avatar: Avatar } {
  return {
    name: player.name ?? PLACEHOLDER_EXPLORER.name,
    avatar: player.avatar ?? PLACEHOLDER_EXPLORER.avatar,
  };
}
