import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  // Mark jsdom and its dependencies as external to avoid ESM/CJS bundling issues
  // in serverless functions. These packages have ESM-only dependencies that don't
  // work well with Next.js bundling.
  serverExternalPackages: ["jsdom", "@mozilla/readability"],
};

export default nextConfig;
