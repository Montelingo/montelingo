import type { Schemas } from "@app/api-client";

// The child's profile on the learning profile (#114, #117): first name, age
// band and animal buddy, each null until a grown-up sets it up. Learner copy
// is Montenegrin, like the rest of the learner area.

export type AgeBand = NonNullable<Schemas["Profile"]["age_band"]>;
export type Avatar = NonNullable<Schemas["Profile"]["avatar"]>;

export type Profile = {
  name: string | null;
  ageBand: AgeBand | null;
  avatar: Avatar | null;
  /** Whether every field is set, so the child can start exploring. */
  isComplete: boolean;
};

/** What the map and home page call the child before the profile is set up. */
export const PLACEHOLDER_EXPLORER_NAME = "Istraživač";

/**
 * The child before the profile is set up, where a buddy is drawn: the fox,
 * the welcome screens' own buddy.
 */
export const PLACEHOLDER_EXPLORER: Pick<Explorer, "name" | "avatar"> = {
  name: PLACEHOLDER_EXPLORER_NAME,
  avatar: "fox",
};

/** How the map shows the child: buddy, name and "Istraživač · 5–6 godina". */
export type Explorer = {
  name: string;
  avatar: Avatar;
  title: string;
};

type AgeBandInfo = {
  /** The band as the cards show it, with an en dash. */
  label: string;
  /** The explorer's title for the band. */
  title: string;
  /** What the band means for the content. */
  detail: string;
  /** The age with its noun, as Montenegrin declines it ("3–4 godine"). */
  years: string;
};

// Keyed by band, so a band the API adds and this list lacks fails typecheck.
const AGE_BAND_INFO: Record<AgeBand, AgeBandInfo> = {
  "3-4": {
    label: "3–4",
    title: "Mali istraživač",
    detail: "slike i zvuci",
    years: "3–4 godine",
  },
  "5-6": {
    label: "5–6",
    title: "Istraživač",
    detail: "prve riječi",
    years: "5–6 godina",
  },
  "7": {
    label: "7",
    title: "Veliki istraživač",
    detail: "kratke rečenice",
    years: "7 godina",
  },
};

/** The three bands, youngest first, as the setup step lists them. */
export const AGE_BANDS: readonly (AgeBandInfo & { id: AgeBand })[] = (
  ["3-4", "5-6", "7"] as const
).map((id) => ({ id, ...AGE_BAND_INFO[id] }));

/** The six buddies, in the Figma order, each named for screen readers. */
export const AVATARS: readonly { id: Avatar; label: string }[] = [
  { id: "fox", label: "Lisica" },
  { id: "bear", label: "Medo" },
  { id: "bunny", label: "Zeko" },
  { id: "frog", label: "Žaba" },
  { id: "owl", label: "Sova" },
  { id: "cat", label: "Maca" },
];

/** The buddy's picture in public/learner. */
export function avatarSrc(avatar: Avatar): string {
  return `/learner/avatar-${avatar}.svg`;
}

export function toProfile(profile: Schemas["Profile"]): Profile {
  return {
    name: profile.name,
    ageBand: profile.age_band,
    avatar: profile.avatar,
    isComplete: profile.is_complete,
  };
}

/** The child as the map shows them, or `null` until the profile is complete. */
export function toExplorer(profile: Profile): Explorer | null {
  const { name, ageBand, avatar, isComplete } = profile;
  if (!isComplete || name === null || ageBand === null || avatar === null) {
    return null;
  }
  const { title, years } = AGE_BAND_INFO[ageBand];
  return { name, avatar, title: `${title} · ${years}` };
}
