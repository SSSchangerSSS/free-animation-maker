import type { NextConfig } from "next";

// BUILD_MODE=static → خروجی GitHub Pages (پوشه out/)
const isStatic = process.env.BUILD_MODE === "static";
const REPO = "free-animation-maker";

const nextConfig: NextConfig = {
  output: isStatic ? "export" : "standalone",
  basePath: isStatic ? `/${REPO}` : undefined,
  assetPrefix: isStatic ? `/${REPO}/` : undefined,
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
