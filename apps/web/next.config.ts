import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // @app/api-client ships TypeScript source, so Next.js must compile it.
  transpilePackages: ["@app/api-client"],
};

export default nextConfig;
