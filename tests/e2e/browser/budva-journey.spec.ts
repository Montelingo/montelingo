import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

// The first chapter of Budva, the starting location, in recording order
// (apps/api/app/modules/content/data/content.json, chapter "budva-beach").
const NA_PLAZI_WORDS = [
  "more",
  "plaža",
  "pijesak",
  "sunce",
  "talas",
  "obala",
  "kamen",
  "stijena",
  "peškir",
  "suncobran",
];

// The happy path of phase 1: a new learner signs up, signs in, and reaches
// the first words. Each run makes its own account, so runs never share
// progress. Sign-up is rate limited per IP (10 an hour), which leaves room
// for both tablet projects and a retry after auth.sh.
test("a new learner reaches Budva's first words", async ({ page }) => {
  const email = `e2e-budva-${randomUUID()}@example.com`;
  const password = `e2e-${randomUUID()}`;

  await test.step("sign up", async () => {
    await page.goto("/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    // Signing up also signs in and goes to the map.
    await expect(page).toHaveURL("/play");
  });

  await test.step("sign out", async () => {
    // Sign out lives in the site header; the learner area leads back to it.
    await page.goto("/");
    const account = page.getByRole("navigation", { name: "Account" });
    await account.getByRole("button", { name: "Sign out" }).click();
    await expect(account.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  await test.step("sign in and land on /play", async () => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/play");
    await expect(
      page.getByRole("heading", { level: 1, name: "Your map" }),
    ).toBeVisible();
  });

  await test.step("open Obala", async () => {
    // A card is named "<name>, <status>", so the name is matched at the start.
    await page
      .getByRole("list", { name: "Regions" })
      .getByRole("link", { name: /^Obala,/ })
      .click();

    await expect(page).toHaveURL("/play/coast");
    await expect(
      page.getByRole("heading", { level: 1, name: "Obala" }),
    ).toBeVisible();
  });

  await test.step("open Budva", async () => {
    await page
      .getByRole("list", { name: "Places" })
      .getByRole("link", { name: /^Budva,/ })
      .click();

    await expect(page).toHaveURL("/play/coast/budva");
    await expect(
      page.getByRole("heading", { level: 1, name: "Budva" }),
    ).toBeVisible();
  });

  await test.step("see Na plaži with its 10 words", async () => {
    await expect(
      page.getByRole("heading", { level: 2, name: "Na plaži" }),
    ).toBeVisible();

    // The chapter's word list is named by its heading.
    const words = page.getByRole("list", { name: "Na plaži" });
    await expect(words.getByRole("listitem")).toHaveCount(10);
    await expect(words.locator("figcaption")).toHaveText(NA_PLAZI_WORDS);
  });
});
