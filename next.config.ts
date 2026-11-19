import { existsSync } from "node:fs";
import type { NextConfig } from "next";

if (existsSync(".env.production.local")) {
  throw new Error(
    "Rename .env.production.local to .env.neon-main: next build and next start load .env.production.local and would connect to the production database.",
  );
}

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  devIndicators: false,
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local"],
  partialPrefetching: true,
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
