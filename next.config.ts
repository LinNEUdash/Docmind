import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  devIndicators: false,
  turbopack: {
    resolveAlias: {
      canvas: { browser: "" },
    },
  },
};

export default nextConfig;
