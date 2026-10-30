import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// .env dùng chung nằm ở gốc monorepo. forceReload vì Next đã nạp (và cache) env của apps/web trước đó.
loadEnvConfig(path.resolve(process.cwd(), "../.."), process.env.NODE_ENV !== "production", undefined, true);

const nextConfig: NextConfig = {
  // Bản build tự chứa để đóng gói Docker; truy vết file từ gốc monorepo (packages/*).
  output: "standalone",
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  cacheComponents: true,
  partialPrefetching: true,
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
