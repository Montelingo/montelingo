import type { Schemas } from "@app/api-client";

import {
  type Avatar,
  PLACEHOLDER_EXPLORER,
  type Profile,
} from "@/features/profile/edge";

import { toWord, type Word } from "./content";

// The Riječi tab (#234, screen 1 of #237): every word the child has learned,
// by place, and where to collect more. The server decides which words are
// learned (#232, ADR 0005), so nothing here counts lessons.

/** A place where the child has seen a lesson, with that lesson's words. */
export type WordPlace = {
  id: string;
  name: string;
  words: readonly Word[];
};

export type LearnedWords = {
  /** In the order the API sends them, which is the map's. */
  places: readonly WordPlace[];
  /** The next open place with words still to learn, or `null` when there is none. */
  nextPlace: { name: string; wordCount: number } | null;
  /** Every word listed, for the header's badge. */
  total: number;
};

/** The learned words, or `error` when they failed to load (a `401` is thrown instead). */
export type WordsResult =
  | { status: "ready"; words: LearnedWords }
  | { status: "error" };

export type WordsData = {
  /** `null` when the words failed to load: then they are not known. */
  words: LearnedWords | null;
  /** The child's buddy for the empty state, or the placeholder fox. */
  avatar: Avatar;
  /** Whether the words failed, which offers a retry. */
  needsRetry: boolean;
};

/** What a practice game's route loads (#235). */
export type PracticeData = {
  /** The learned places, or `null` when the words failed to load. */
  places: readonly WordPlace[] | null;
  /** The learner's name, for "Bravo, Mia!", or `null` without one. */
  learnerName: string | null;
};

export function toLearnedWords(data: Schemas["LearnedWords"]): LearnedWords {
  // A seen lesson whose words are not recorded yet lists its place with no
  // words: nothing to show, so the place is left out.
  const places = data.places
    .filter((place) => place.words.length > 0)
    .map((place) => ({
      id: place.id,
      name: place.name,
      words: place.words.map(toWord),
    }));
  return {
    places,
    nextPlace:
      data.next_place === null
        ? null
        : { name: data.next_place.name, wordCount: data.next_place.word_count },
    total: places.reduce((sum, place) => sum + place.words.length, 0),
  };
}

/** Joins the words and the profile (`null` when it failed or is not set up). */
export function toWordsData(
  result: WordsResult,
  profile: Profile | null,
): WordsData {
  return {
    words: result.status === "ready" ? result.words : null,
    avatar: profile?.avatar ?? PLACEHOLDER_EXPLORER.avatar,
    needsRetry: result.status === "error",
  };
}

/**
 * A number of words, as Montenegrin says it: "1 riječ", "21 riječ", but
 * "2 riječi", "5 riječi" and "11 riječi". Only the count's last digit being 1,
 * outside the teens, takes the singular.
 */
export function wordCount(count: number): string {
  const isSingular = count % 10 === 1 && count % 100 !== 11;
  return `${count} ${isSingular ? "riječ" : "riječi"}`;
}
