import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { gate, passGate, tapWrongDigit } from "./grown-ups";

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
// the first words. Then a grown-up opens the Ja tab and passes the gate into
// the grown-ups area (#180). Each run makes its own account, so runs never
// share progress. Sign-up is rate limited per IP (10 an hour), so #180 shares
// this test's account: README.md has how the suite shares them.
test("a new learner reaches Budva's first words, and a grown-up opens the grown-ups area (#180)", async ({
  page,
}) => {
  // Two password hashes, a dozen screens and two 1.5 s holds of the gate:
  // over the default 30 s when the stack is cold or every worker is busy.
  test.setTimeout(90_000);
  const email = `e2e-budva-${randomUUID()}@example.com`;
  const password = `e2e-${randomUUID()}`;

  await test.step("sign up", async () => {
    await page.goto("/sign-up");
    await page.getByLabel("E-pošta odrasle osobe").fill(email);
    await page.getByLabel("Lozinka", { exact: true }).fill(password);
    await page.getByLabel("Potvrdi lozinku").fill(password);
    await page.getByRole("button", { name: "Napravi nalog" }).click();

    // Signing up also signs in, and a new account sets up the child first.
    // Sign-up hashes the password and signs in: slow when several run at once.
    await expect(page).toHaveURL("/play/welcome", { timeout: 15_000 });
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
    // Sign out is on the home page (#152), where the learner area leads back.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dobro došli nazad!" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Odjavi se" }).click();
    await expect(page.getByRole("link", { name: "Imam nalog" })).toBeVisible();
  });

  await test.step("sign in and land on /play", async () => {
    await page.goto("/sign-in");
    await page.getByLabel("E-pošta", { exact: true }).fill(email);
    await page.getByLabel("Lozinka", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Prijavi se" }).click();

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

  await test.step("open Na plaži from its card", async () => {
    const chapters = page.getByRole("list", { name: "Chapters" });
    await expect(chapters.getByRole("link")).toHaveCount(2);
    await chapters.getByRole("link", { name: /^Na plaži/ }).click();

    await expect(page).toHaveURL("/play/coast/budva/budva-beach");
    await expect(
      page.getByRole("heading", { level: 1, name: "Na plaži" }),
    ).toBeVisible();
  });

  await test.step("see Na plaži's 10 words", async () => {
    const words = page.getByRole("list", { name: "Words" });
    await expect(words.getByRole("listitem")).toHaveCount(10);
    await expect(words.locator("figcaption")).toHaveText(NA_PLAZI_WORDS);
  });

  await test.step("go Back from the lesson to the chapter", async () => {
    await page
      .getByRole("list", { name: "Na plaži lesson and games" })
      .getByRole("link", { name: /^Lesson/ })
      .click();
    await expect(page).toHaveURL("/play/coast/budva/budva-beach/lesson");

    await page
      .getByRole("navigation", { name: "Learner" })
      .getByRole("link", { name: "Back" })
      .click();
    await expect(page).toHaveURL("/play/coast/budva/budva-beach");
  });

  await test.step("the Ja tab shows the child and their counts", async () => {
    await page.goto("/play");
    await page
      .getByRole("navigation", { name: "Glavni meni" })
      .getByRole("link", { name: "Ja" })
      .click();

    await expect(page).toHaveURL("/play/me");
    await expect(
      page.getByRole("heading", { level: 1, name: "Mia" }),
    ).toBeVisible();
    await expect(page.getByText("Istraživač · 5–6 godina")).toBeVisible();
    // The lesson was opened but not finished, so nothing is collected yet.
    for (const name of ["Zvjezdice: 0", "Riječi: 0", "Naljepnice: 0"]) {
      await expect(page.getByRole("group", { name })).toBeVisible();
    }
  });

  await test.step("a wrong digit keeps the gate shut", async () => {
    await page.getByRole("button", { name: "Za roditelje" }).click();
    await expect(gate(page)).toBeVisible();

    await tapWrongDigit(page);

    await expect(gate(page)).toBeVisible();
    await expect(page).toHaveURL("/play/me");
  });

  await test.step("holding the named digit opens the grown-ups area", async () => {
    await passGate(page);

    await expect(page).toHaveURL("/play/me/grown-ups");
    await expect(
      page.getByRole("heading", { level: 1, name: "Za roditelje" }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Nalog" })).toContainText(
      email,
    );
    await expect(
      page.getByRole("group", { name: "Obala: 0 od 6 mjesta" }),
    ).toBeVisible();
  });

  await test.step("a reload shows the gate again", async () => {
    await page.reload();

    await expect(gate(page)).toBeVisible();
    await expect(page.getByText(email)).toHaveCount(0);

    await passGate(page);
    await expect(page.getByRole("region", { name: "Nalog" })).toContainText(
      email,
    );
  });
});
