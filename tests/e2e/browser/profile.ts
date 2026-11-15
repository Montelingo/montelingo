import { expect, type Page } from "@playwright/test";

// Helpers for the child profile (#118). A new account's /play sends it to the
// profile setup first, so specs that are not about the setup set the profile
// up through the API instead of the screens. Not a spec: Playwright runs
// `*.spec.ts` only.

/**
 * Sets up the signed-in account's child profile through the API, unless it is
 * set up already (so an existing E2E_EMAIL account keeps its own), then opens
 * the map.
 */
export async function setUpProfileAndOpenMap(page: Page): Promise<void> {
  const current = await page.request.get("/api/v1/profile");
  expect(current.status()).toBe(200);
  const profile = (await current.json()) as { is_complete: boolean };
  if (!profile.is_complete) {
    const origin = new URL(page.url()).origin;
    const saved = await page.request.put("/api/v1/profile", {
      data: { name: "Mia", age_band: "5-6", avatar: "fox" },
      headers: { Origin: origin },
    });
    expect(saved.status()).toBe(200);
  }
  await page.goto("/play");
  await expect(page).toHaveURL("/play");
}
