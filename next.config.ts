import type { NextConfig } from "next";

/**
 * Resumark is a fully client-side tool: no API routes, no server data, no auth.
 * `output: "export"` produces a 100% static bundle (`out/`) which is served by
 * `npm start` (see scripts/serve-static.mjs) — proof that the MVP needs no backend.
 */
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
};

export default nextConfig;
