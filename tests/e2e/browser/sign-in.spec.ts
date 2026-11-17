import { expect, test } from "@playwright/test";

test("the sign-in page loads", async ({ page }) => {
  const response = await page.goto("/sign-in");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Prijava/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Dobro došli nazad" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Prijavi se" })).toBeVisible();
});
