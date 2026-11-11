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

export const progressSchema = z.object({
  regions: z.array(stateEntrySchema),
  locations: z.array(stateEntrySchema),
}) satisfies z.ZodType<Schemas["ProgressState"]>;
