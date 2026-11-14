import { defineConfig, devices } from "@playwright/test";

// Runs against an already running stack (docker compose up), so there is no
// webServer block. WEB_URL matches the shell scripts beside this file.
const baseURL = process.env.WEB_URL ?? "http://localhost:3000";

// The smallest supported learner device is the iPad mini 6, 744 x 1133 CSS px,
// in portrait and landscape (docs/frontend-architecture.md).
const tablet = {
  ...devices["Desktop Chrome"],
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

export default defineConfig({
  testDir: "./browser",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "tablet-portrait",
      use: { ...tablet, viewport: { width: 744, height: 1133 } },
    },
    {
      name: "tablet-landscape",
      use: { ...tablet, viewport: { width: 1133, height: 744 } },
    },
  ],
});
