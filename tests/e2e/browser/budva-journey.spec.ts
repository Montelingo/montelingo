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

    // Signing up also signs in, and a new account sets up the child first.
    await expect(page).toHaveURL("/play/welcome");
  });

  await test.step("set up the child's profile (#118)", async () => {
    await expect(
      page.getByRole("heading", { level: 1, name: "Ko istražuje?" }),
    ).toBeVisible();
    await page.getByLabel("Ime djeteta").fill("Mia");
    await page.getByRole("radio", { name: "Sova" }).check({ force: true });
    await page.getByRole("button", { name: "Dalje" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Koliko godina ima Mia?" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: /^5–6/ }).check({ force: true });
    await page.getByRole("button", { name: "Dalje" }).click();

    await expect(
      page.getByRole("heading", { name: "Spremni za istraživanje!" }),
    ).toBeVisible();
    await expect(page.getByText("Prva stanica: Budva, Obala.")).toBeVisible();
    await page.getByRole("button", { name: "Krenimo!" }).click();
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
    // The map's heading is for screen readers; the map shows its own title.
    await expect(
      page.getByRole("heading", { level: 1, name: "Mapa" }),
    ).toBeAttached();
  });

  await test.step("open Obala", async () => {
    // On the map, a region is a link named "<name>, <status>", so the name
    // is matched at the start. Its shape is long and thin, so it is opened
    // with the keyboard rather than a tap in the middle of its box, which
    // can fall on the sea or the next region.
    const map = page.getByRole("group", { name: "Mapa Crne Gore" });
    const obala = map.getByRole("link", { name: /^Obala,/ });
    await obala.focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/play/coast");
    await expect(
      page.getByRole("heading", { level: 1, name: "Obala" }),
    ).toBeAttached();
  });

  await test.step("open Budva's level card", async () => {
    // A tap on an open place opens its level card, over the region's map.
    await page
      .getByRole("group", { name: "Mjesta" })
      .getByRole("link", { name: /^Budva,/ })
      .click();

    await expect(page).toHaveURL("/play/coast?place=budva");
    await expect(page.getByRole("dialog", { name: "Budva" })).toBeVisible();
  });

  await test.step("open Budva", async () => {
    await page
      .getByRole("dialog", { name: "Budva" })
      .getByRole("link", { name: "Kreni!" })
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
