import type { NextConfig } from "next";

// Its URL carries a password-reset token (`?token=`).
const RESET_PASSWORD_PATH = "/reset-password";

const nextConfig: NextConfig = {
  output: "standalone",
  // @app/api-client ships TypeScript source, so Next.js must compile it.
  transpilePackages: ["@app/api-client"],
  // `pnpm lint:web` owns linting in CI; Next's build-time lint duplicates it and
  // cannot detect plugins registered only for **/*.{ts,tsx} in eslint.config.mjs.
  eslint: { ignoreDuringBuilds: true },
  // Headers apply before any of the page is parsed. Next.js renders the page's
  // own <meta name="referrer"> after the stylesheet and scripts in <head>,
  // which the browser may already be requesting with the full URL as Referer.
  headers() {
    return Promise.resolve([
      {
        source: RESET_PASSWORD_PATH,
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          // Next.js already sends no-store for this dynamic page; this keeps a
          // page rendered for a token out of every cache even if that changes.
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ]);
  },
  logging: {
    // `next dev` logs each request's URL with its query, which would print the token.
    incomingRequests: { ignore: [/^\/reset-password(?:[/?]|$)/] },
  },
};

export default nextConfig;
