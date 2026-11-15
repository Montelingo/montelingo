import type { Schemas } from "@app/api-client";

import type { AgeBand, Avatar, Profile } from "./profile";

// The child's profile setup (#118, Figma A5, A5e, A6): the name and buddy,
// then the age band, then saving, then "ready to explore". Pure: the setup
// screen drives it with useReducer and does the saving itself, dispatching
// `saved` or `save-failed`.

/** The API's limit, in letters (code points), as Python's `len` counts. */
export const NAME_MAX_LENGTH = 30;

export type SetupStep = "who" | "age" | "ready";

export type SetupState = {
  step: SetupStep;
  /** The name as typed; trimmed when checked and sent. */
  name: string;
  avatar: Avatar;
  ageBand: AgeBand | null;
  /** What to fix on the current step, in Montenegrin, or `null`. */
  error: string | null;
  /** Whether the profile is being saved; Next and Back wait meanwhile. */
  saving: boolean;
};

export type SetupAction =
  | { type: "name-changed"; name: string }
  | { type: "avatar-picked"; avatar: Avatar }
  | { type: "band-picked"; ageBand: AgeBand }
  | { type: "next" }
  | { type: "back" }
  | { type: "saved" }
  | { type: "save-failed" };

const MESSAGES = {
  noName: "Dodaj ime",
  longName: `Ime može imati najviše ${NAME_MAX_LENGTH} slova`,
  noBand: "Odaberi uzrast",
  saveFailed: "Nije sačuvano. Pokušaj ponovo.",
} as const;

export function initialSetup(): SetupState {
  return {
    step: "who",
    name: "",
    avatar: "fox",
    ageBand: null,
    error: null,
    saving: false,
  };
}

export function setupReducer(
  state: SetupState,
  action: SetupAction,
): SetupState {
  switch (action.type) {
    case "name-changed":
      return { ...state, name: action.name, error: null };
    case "avatar-picked":
      return { ...state, avatar: action.avatar };
    case "band-picked":
      return { ...state, ageBand: action.ageBand, error: null };
    case "next":
      return next(state);
    case "back":
      return state.step === "age" && !state.saving
        ? { ...state, step: "who", error: null }
        : state;
    case "saved":
      return { ...state, step: "ready", saving: false, error: null };
    case "save-failed":
      return { ...state, saving: false, error: MESSAGES.saveFailed };
  }
}

/** What to send to PUT /profile, or `null` until every step is done. */
export function toProfileUpdate(
  state: SetupState,
): Schemas["ProfileUpdate"] | null {
  if (state.ageBand === null || nameError(state.name) !== null) {
    return null;
  }
  return {
    name: state.name.trim(),
    age_band: state.ageBand,
    avatar: state.avatar,
  };
}

function next(state: SetupState): SetupState {
  if (state.saving) {
    return state;
  }
  if (state.step === "who") {
    const error = nameError(state.name);
    return error === null
      ? { ...state, step: "age", error: null }
      : { ...state, error };
  }
  if (state.step === "age") {
    return state.ageBand === null
      ? { ...state, error: MESSAGES.noBand }
      : { ...state, saving: true, error: null };
  }
  return state;
}

function nameError(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed === "") {
    return MESSAGES.noName;
  }
  return [...trimmed].length > NAME_MAX_LENGTH ? MESSAGES.longName : null;
}

/** Where a profile that is not set up goes before the map. */
export const PROFILE_SETUP_PATH = "/play/welcome";

/**
 * Whether the child must set up the profile before the map: when it is not
 * complete. A profile that could not be read (`null`) lets them through, so an
 * API hiccup never locks a child out of the map.
 */
export function needsSetup(profile: Profile | null): boolean {
  return profile !== null && !profile.isComplete;
}
