import type { NextConfig } from "next";

// A build id that changes on every deploy, so the running app can tell when
// the server is newer than itself.
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
  process.env.VERCEL_DEPLOYMENT_ID ??
  String(Date.now());

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId },

  // Don't let the client router serve a stale page after a new deployment.
  experimental: { staleTimes: { dynamic: 0, static: 0 } },

  async headers() {
    const noStore = [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }];
    return [
      { source: "/sw.js", headers: noStore },
      { source: "/manifest.json", headers: noStore },
      { source: "/version.json", headers: [{ key: "Cache-Control", value: "no-store" }] },
      // the app shell itself must always revalidate
      { source: "/", headers: noStore },
      { source: "/:path*", headers: noStore },
    ];
  },
};

export default nextConfig;
