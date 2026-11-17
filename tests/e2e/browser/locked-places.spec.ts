import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { setUpProfileAndOpenMap } from "./profile";

// For local repeated runs, provide an existing account via E2E_EMAIL and
// E2E_PASSWORD. CI without those variables still verifies new-account state.
test("locked regions and places cannot be opened, including by URL (#104)", async ({
  page,
}) => {
  const existingEmail = process.env.E2E_EMAIL;
  const existingPassword = process.env.E2E_PASSWORD;
  if (Boolean(existingEmail) !== Boolean(existingPassword)) {
    throw new Error("Set both E2E_EMAIL and E2E_PASSWORD, or neither.");
  }

  await test.step("authenticate a learner", async () => {
    if (existingEmail && existingPassword) {
      await page.goto("/sign-in");
      await page.getByLabel("E-pošta", { exact: true }).fill(existingEmail);
      await page.getByLabel("Lozinka", { exact: true }).fill(existingPassword);
      await page.getByRole("button", { name: "Prijavi se" }).click();
    } else {
      const email = `e2e-locked-${randomUUID()}@example.com`;
      const password = `e2e-${randomUUID()}`;
      await page.goto("/sign-up");
      await page.getByLabel("E-pošta odrasle osobe").fill(email);
      await page.getByLabel("Lozinka", { exact: true }).fill(password);
      await page.getByLabel("Potvrdi lozinku").fill(password);
      await page.getByRole("button", { name: "Napravi nalog" }).click();
    }

    // Sign-up or sign-in hashes the password: slow when several run at once.
    await expect(page).toHaveURL(/\/play(\/welcome)?$/, { timeout: 15_000 });
    await setUpProfileAndOpenMap(page);
    await expect(
      page.getByRole("heading", { level: 1, name: "Mapa" }),
    ).toBeAttached();
  });

  await test.step("Centralna Crna Gora and Sjever i planine are locked", async () => {
    const map = page.getByRole("group", { name: "Mapa Crne Gore" });

    for (const name of ["Centralna Crna Gora", "Sjever i planine"]) {
      const region = map.getByRole("link", {
        name: `${name}, zaklju\u010dano`,
      });

      await expect(region).toBeAttached();
      await expect(region).toHaveAttribute("aria-disabled", "true");
      await expect(region).not.toHaveAttribute("href", /.+/);
      await region.dispatchEvent("click");
      await expect(page).toHaveURL("/play");
    }

    const coast = map.getByRole("link", { name: "Obala, otvoreno" });
    await expect(coast).toHaveAttribute("href", "/play/coast");
    await coast.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/play/coast");
  });

  await test.step("five places in Obala are locked", async () => {
    const places = page.getByRole("group", { name: "Mjesta", exact: true });
    await expect(places.getByRole("link")).toHaveCount(6);

    const locked = places.getByRole("link", { name: /zaklju\u010dano/ });
    await expect(locked).toHaveCount(5);
    for (const place of await locked.all()) {
      await expect(place).toHaveAttribute("aria-disabled", "true");
      await expect(place).not.toHaveAttribute("href", /.+/);
    }

    const budva = places.getByRole("link", { name: /^Budva,/ });
    await expect(budva).toHaveAttribute("href", /place=budva/);

    const kotor = places.getByRole("link", { name: /^Kotor,/ });
    await expect(kotor).toHaveAttribute("aria-disabled", "true");
    await kotor.dispatchEvent("click");
    await expect(page).toHaveURL("/play/coast");
  });

  await test.step("direct Kotor URL cannot reveal words", async () => {
    await page.goto("/play/coast/kotor");
    await expect(page).toHaveURL(/\/play\/coast(?:\?.*)?$/);
    await expect(
      page.getByRole("group", { name: "Mjesta", exact: true }),
    ).toBeAttached();
    await expect(
      page.getByRole("heading", { level: 1, name: "Kotor" }),
    ).toHaveCount(0);
  });
});
