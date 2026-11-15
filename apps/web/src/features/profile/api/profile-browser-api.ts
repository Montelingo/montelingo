import { type Schemas, unwrap } from "@app/api-client";

import { getBrowserApiClient } from "@/lib/browser-api";

// Saving runs in the browser, through the same-origin proxy, so the API sees
// the real Origin (CSRF check, ADR 0004) and the session cookie, like the auth
// mutations.

/** Sets the whole child profile. Rejects on any failure, `422` included. */
export async function saveProfile(
  update: Schemas["ProfileUpdate"],
): Promise<void> {
  await unwrap(getBrowserApiClient().PUT("/api/v1/profile", { body: update }));
}
