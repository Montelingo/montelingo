import type { Schemas } from "@app/api-client";

// The map's content, the same for every account (ADR 0005), mapped from API
// responses that schemas.ts has checked. Generated types stop here: screens
// only see these. Ids are the content slugs (`coast`, `kotor`), except a
// word's, which is its UUID.

export type Region = {
  id: string;
  name: string;
  locationCount: number;
};

export type Location = {
  id: string;
  name: string;
  regionId: string;
  chapterCount: number;
  wordCount: number;
};

/** A region with its locations, in content order. */
export type RegionDetail = {
  id: string;
  name: string;
  locations: readonly Location[];
};

export type Word = {
  id: string;
  /** Recording number (1–300), stable across environments, and the audio file name. */
  number: number;
  text: string;
  note: string | null;
  /** Always `null` in phase 1 (ADR 0005). */
  imageUrl: string | null;
  /** Always `null` in phase 1 (ADR 0005). */
  audioUrl: string | null;
};

export type Chapter = {
  id: string;
  title: string;
  /** Recording order (1–30). */
  position: number;
  words: readonly Word[];
};

/** A location with its chapters, in recording order. */
export type LocationDetail = {
  id: string;
  name: string;
  regionId: string;
  chapters: readonly Chapter[];
};

export function toRegion(data: Schemas["RegionSummary"]): Region {
  return { id: data.id, name: data.name, locationCount: data.location_count };
}

function toLocation(data: Schemas["LocationSummary"]): Location {
  return {
    id: data.id,
    name: data.name,
    regionId: data.region_id,
    chapterCount: data.chapter_count,
    wordCount: data.word_count,
  };
}

export function toRegionDetail(data: Schemas["RegionDetail"]): RegionDetail {
  return {
    id: data.id,
    name: data.name,
    locations: data.locations.map(toLocation),
  };
}

function toWord(data: Schemas["Word"]): Word {
  return {
    id: data.id,
    number: data.number,
    text: data.text,
    note: data.note,
    imageUrl: data.image_url,
    audioUrl: data.audio_url,
  };
}

function toChapter(data: Schemas["Chapter"]): Chapter {
  return {
    id: data.id,
    title: data.title,
    position: data.position,
    words: data.words.map(toWord),
  };
}

export function toLocationDetail(
  data: Schemas["LocationDetail"],
): LocationDetail {
  return {
    id: data.id,
    name: data.name,
    regionId: data.region_id,
    chapters: data.chapters.map(toChapter),
  };
}
