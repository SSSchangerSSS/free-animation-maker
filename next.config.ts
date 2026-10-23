import type { NextConfig } from "next";
// A24 — یک منبع واحد برای مسیر پایه (همین مقدار در URL مدل‌ها هم استفاده می‌شود)
import { BASE_PATH } from "./src/lib/base-path";

// BUILD_MODE=static → خروجی GitHub Pages (پوشه out/)
const isStatic = process.env.BUILD_MODE === "static";

const nextConfig: NextConfig = {
  output: isStatic ? "export" : "standalone",
  basePath: isStatic ? BASE_PATH : undefined,
  assetPrefix: isStatic ? `${BASE_PATH}/` : undefined,
  images: { unoptimized: true },
  // A25 — کنترل کیفیت ساخت دوباره فعال شد
  reactStrictMode: true,
};

export default nextConfig;
