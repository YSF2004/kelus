import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";

// The stamp written before each build (scripts/write-version.mjs), baked in so an open tab knows its own version.
const buildId = existsSync("public/version.json") ? JSON.parse(readFileSync("public/version.json", "utf8")).id : "dev";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Isolate an explicitly ported E2E server from an existing local next dev session.
  distDir: process.env.KELUS_E2E_PORT ? `.next-e2e-${process.env.KELUS_E2E_PORT}` : ".next",
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // The dev-only "N" bubble sits where the phone tab bar is; errors are still shown in development.
  devIndicators: false,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
};

export default nextConfig;
