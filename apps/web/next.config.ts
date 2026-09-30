import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // @app/api-client ships TypeScript source, so Next.js must compile it.
  transpilePackages: ["@app/api-client"],
  // `pnpm lint:web` owns linting in CI; Next's build-time lint duplicates it and
  // cannot detect plugins registered only for **/*.{ts,tsx} in eslint.config.mjs.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
