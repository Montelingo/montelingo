import type { Schemas } from "@app/api-client";
import { z } from "zod";

// Runtime check for GET /profile (apps/api/app/modules/progress/schemas.py).
// The map picks the buddy's picture from these values, so a response outside
// the contract fails here. It `satisfies` the generated type, so it cannot
// drift from the contract. The name's length is the API's to check: it counts
// characters (code points), which JavaScript's `length` does not.
export const profileSchema = z.object({
  name: z.string().nullable(),
  age_band: z.enum(["3-4", "5-6", "7"]).nullable(),
  avatar: z.enum(["fox", "bear", "bunny", "frog", "owl", "cat"]).nullable(),
  is_complete: z.boolean(),
}) satisfies z.ZodType<Schemas["Profile"]>;
