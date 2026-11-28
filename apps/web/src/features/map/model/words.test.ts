import type { Schemas } from "@app/api-client";
import { describe, expect, it } from "vitest";

import type { Profile } from "@/features/profile/edge";

import { toLearnedWords, toWordsData, wordCount } from "./words";

const MORE: Schemas["Word"] = {
  id: "00000000-0000-4000-8000-000000000001",
  number: 1,
  text: "more",
  note: null,
  image_url: "/media/words/0001.webp",
  image_url_512: "/media/words/0001-512.webp",
  audio_url: null,
};

const API: Schemas["LearnedWords"] = {
  places: [
    {
      id: "budva",
      region_id: "coast",
      name: "Budva",
      words: [
        MORE,
        { ...MORE, id: MORE.id.replace("1", "2"), number: 2, text: "pijesak" },
      ],
    },
  ],
  next_place: { id: "kotor", region_id: "coast", name: "Kotor", word_count: 4 },
};

const MIA: Profile = {
  name: "Mia",
  ageBand: "5-6",
  avatar: "owl",
  isComplete: true,
};

describe("wordCount", () => {
  it.each([
    [1, "1 riječ"],
    [2, "2 riječi"],
    [4, "4 riječi"],
    [5, "5 riječi"],
    [11, "11 riječi"],
    [21, "21 riječ"],
    [22, "22 riječi"],
    [25, "25 riječi"],
    [101, "101 riječ"],
    [111, "111 riječi"],
  ])("says %i as %s", (count, label) => {
    expect(wordCount(count)).toBe(label);
  });
});

describe("toLearnedWords", () => {
  it("keeps the places in the API's order, with their words and the next place", () => {
    expect(toLearnedWords(API)).toEqual({
      places: [
        {
          id: "budva",
          name: "Budva",
          words: [
            expect.objectContaining({
              number: 1,
              text: "more",
              imageUrl: "/media/words/0001.webp",
              imageUrl512: "/media/words/0001-512.webp",
            }),
            expect.objectContaining({ number: 2, text: "pijesak" }),
          ],
        },
      ],
      nextPlace: { name: "Kotor", wordCount: 4 },
      total: 2,
    });
  });

  it("leaves out a place whose seen lessons have no words yet", () => {
    const learned = toLearnedWords({
      ...API,
      places: [
        { id: "kotor", region_id: "coast", name: "Kotor", words: [] },
        ...API.places,
      ],
    });

    expect(learned.places.map(({ id }) => id)).toEqual(["budva"]);
    expect(learned.total).toBe(2);
  });

  it("has no next place when the API sends none", () => {
    expect(toLearnedWords({ places: [], next_place: null })).toEqual({
      places: [],
      nextPlace: null,
      total: 0,
    });
  });
});

describe("toWordsData", () => {
  it("joins the words with the child's buddy", () => {
    const words = toLearnedWords(API);

    expect(toWordsData({ status: "ready", words }, MIA)).toEqual({
      words,
      avatar: "owl",
      needsRetry: false,
    });
  });

  it("has no words and offers a retry when they failed to load", () => {
    expect(toWordsData({ status: "error" }, MIA)).toEqual({
      words: null,
      avatar: "owl",
      needsRetry: true,
    });
  });

  it("uses the placeholder buddy without a profile, and still shows the words", () => {
    const words = toLearnedWords(API);

    expect(toWordsData({ status: "ready", words }, null)).toMatchObject({
      words,
      avatar: "fox",
      needsRetry: false,
    });
  });
});
