import { fileURLToPath } from "node:url";

import mdx from "@mdx-js/rollup";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Compiles .mdx imports (the privacy policy) the way @next/mdx does in Next.js.
  plugins: [mdx()],
  // tsconfig keeps `jsx: preserve` for Next.js, so tell esbuild to use the React 17+ JSX runtime.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside the React Server build, so tests load its no-op entry.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    include: ["src/**/*.test.{ts,tsx}", "next.config.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // axe on a full screen (a town's 40 word cards) takes a few seconds alone
    // and several times that while the whole suite shares the CPU.
    testTimeout: 20_000,
  },
});
