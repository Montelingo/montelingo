import { expect, test } from "@playwright/test";

test("the sign-in page loads in the welcome frame", async ({ page }) => {
  const response = await page.goto("/sign-in");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Prijava/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Dobro došli nazad" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Prijavi se" })).toBeVisible();
  // Full screen, without the site header, with Back to the welcome (#153).
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Nazad" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(
    page.getByRole("link", { name: "Zaboravili ste lozinku?" }),
  ).toHaveAttribute("href", "/forgot-password");
});

test("a failed sign-in is summed up above the fields", async ({ page }) => {
  await page.goto("/sign-in");

  await page.getByRole("button", { name: "Prijavi se" }).click();

  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Ispravi 2 stvari ispod",
  );
  await expect(page.getByLabel("E-pošta", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
});
