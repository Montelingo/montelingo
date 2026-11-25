import type { Schemas } from "@app/api-client";
import { z } from "zod";

// Runtime checks for the content and progress API (apps/api/app/modules/content
// and progress/schemas.py). The map trusts ids and states to draw and link
// places, so a response that breaks the contract fails here, in one place,
// instead of rendering a wrong map. Each schema `satisfies` the generated type,
// so it cannot drift from the contract: the generated types stay the only
// response types, and the schemas only add the checks TypeScript cannot make.

// Content is identified by its slug, which the API exposes as `id` (ADR 0005).
const slugSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);

const countSchema = z.number().int().min(0);

const regionSummarySchema = z.object({
  id: slugSchema,
  name: z.string(),
  location_count: countSchema,
}) satisfies z.ZodType<Schemas["RegionSummary"]>;

export const regionListSchema = z.object({
  items: z.array(regionSummarySchema),
  page: z.object({
    has_more: z.boolean(),
    next_cursor: z.string().nullable(),
  }),
}) satisfies z.ZodType<Schemas["PaginatedResponse_RegionSummary_"]>;

const locationSummarySchema = z.object({
  id: slugSchema,
  name: z.string(),
  region_id: slugSchema,
  chapter_count: countSchema,
  word_count: countSchema,
}) satisfies z.ZodType<Schemas["LocationSummary"]>;

export const regionDetailSchema = z.object({
  id: slugSchema,
  name: z.string(),
  locations: z.array(locationSummarySchema),
}) satisfies z.ZodType<Schemas["RegionDetail"]>;

const wordSchema = z.object({
  id: z.uuid(),
  number: z.number().int().min(1),
  text: z.string(),
  note: z.string().nullable(),
  image_url: z.string().nullable(),
  audio_url: z.string().nullable(),
}) satisfies z.ZodType<Schemas["Word"]>;

const chapterSchema = z.object({
  id: slugSchema,
  title: z.string(),
  position: z.number().int().min(1),
  words: z.array(wordSchema),
}) satisfies z.ZodType<Schemas["Chapter"]>;

export const locationDetailSchema = z.object({
  id: slugSchema,
  name: z.string(),
  region_id: slugSchema,
  chapters: z.array(chapterSchema),
}) satisfies z.ZodType<Schemas["LocationDetail"]>;

const stateEntrySchema = z.object({
  id: slugSchema,
  state: z.enum(["locked", "available", "in-progress", "completed"]),
});

const gameStateSchema = z.object({
  id: z.enum(["memory", "match"]),
  state: z.enum(["locked", "available", "completed"]),
}) satisfies z.ZodType<Schemas["GameState"]>;

// A chapter's lesson and games (ADR 0006). The server decides every lock.
const chapterStateSchema = z.object({
  id: slugSchema,
  lesson: z.enum(["todo", "done"]),
  games: z.array(gameStateSchema),
}) satisfies z.ZodType<Schemas["ChapterState"]>;

// What the child has collected (#175). The server counts them; the frontend
// never does (ADR 0005).
const progressCountsSchema = z.object({
  words_learned: countSchema,
  stickers: countSchema,
}) satisfies z.ZodType<Schemas["ProgressCounts"]>;

export const progressSchema = z.object({
  regions: z.array(stateEntrySchema),
  locations: z.array(stateEntrySchema),
  chapters: z.array(chapterStateSchema),
  counts: progressCountsSchema,
}) satisfies z.ZodType<Schemas["ProgressState"]>;

// The child's learned words by place, and the next place to learn more (#232).
const learnedPlaceSchema = z.object({
  id: slugSchema,
  region_id: slugSchema,
  name: z.string(),
  words: z.array(wordSchema),
}) satisfies z.ZodType<Schemas["LearnedPlace"]>;

export const learnedWordsSchema = z.object({
  places: z.array(learnedPlaceSchema),
  next_place: z
    .object({
      id: slugSchema,
      region_id: slugSchema,
      name: z.string(),
      word_count: z.number().int().min(1),
    })
    .nullable(),
}) satisfies z.ZodType<Schemas["LearnedWords"]>;
