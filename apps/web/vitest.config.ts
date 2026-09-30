import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig keeps `jsx: preserve` for Next.js, so tell esbuild to use the React 17+ JSX runtime.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
