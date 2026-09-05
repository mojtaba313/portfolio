import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Cache Components (Partial Prerendering + the `"use cache"` directive).
   *
   * Enabled from day one on purpose: it changes how every route is rendered,
   * so adopting it later means revisiting every data read in the app. With it
   * on, each route must produce a static shell — any uncached data access has
   * to be wrapped in `"use cache"` or sit behind a `<Suspense>` boundary.
   */
  cacheComponents: true,
};

export default nextConfig;
