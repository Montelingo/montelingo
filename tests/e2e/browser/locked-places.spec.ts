import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

// End-to-end coverage of Issue #104 against the real Compose-backed app.
// A new account has no completed places; the server determines its locks.
test("locked regions and places cannot be opened, including by URL (#104)", async ({
  page,
}) => {
  const email = `e2e-locked-${randomUUID()}@example.com`;
  const password = `e2e-${randomUUID()}`;

  await test.step("create a new learner", async () => {
    await page.goto("/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL("/play");
    await expect(
      page.getByRole("heading", { level: 1, name: "Your map" }),
    ).toBeVisible();
  });

  await test.step("Centralna Crna Gora and Sjever i planine are locked", async () => {
    const regions = page.getByRole("list", { name: "Regions" });

    for (const name of ["Centralna Crna Gora", "Sjever i planine"]) {
      const region = regions.getByRole("link", {
        name: `${name}, Locked`,
      });

      await expect(region).toBeVisible();
      await expect(region).toHaveAttribute("aria-disabled", "true");
      await expect(region).not.toHaveAttribute("href", /.+/);

      // Playwright's normal click() correctly rejects aria-disabled elements.
      // Dispatch a click to exercise the card's feedback handler anyway.
      await region.dispatchEvent("click");
      await expect(page).toHaveURL("/play");
    }

    await expect(
      regions.getByRole("link", { name: /^Obala, Open/ }),
    ).toBeVisible();
  });

  await test.step("only Budva is available within Obala", async () => {
    await page
      .getByRole("list", { name: "Regions" })
      .getByRole("link", { name: /^Obala,/ })
      .click();

    await expect(page).toHaveURL("/play/coast");

    const places = page.getByRole("list", { name: "Places" });
    await expect(places.getByRole("link")).toHaveCount(6);

    const lockedPlaces = places.getByRole("link", { name: /, Locked$/ });
    await expect(lockedPlaces).toHaveCount(5);

    for (const place of await lockedPlaces.all()) {
      await expect(place).toHaveAttribute("aria-disabled", "true");
      await expect(place).not.toHaveAttribute("href", /.+/);
    }

    await expect(
      places.getByRole("link", { name: /^Budva, Open/ }),
    ).toBeVisible();

    const kotor = places.getByRole("link", { name: /^Kotor, Locked$/ });
    await expect(kotor).toBeVisible();
    await kotor.dispatchEvent("click");
    await expect(page).toHaveURL("/play/coast");
  });

  await test.step("direct Kotor URL does not reveal its words", async () => {
    await page.goto("/play/coast/kotor");

    // The server gate sends a learner back to the region, optionally with a notice.
    await expect(page).toHaveURL(/\/play\/coast(?:\?.*)?$/);
    await expect(page.getByRole("list", { name: "Places" })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "Kotor" }),
    ).toHaveCount(0);
  });
});
