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

  /**
   * Uploaded images live in the bucket repository and are served from
   * `raw.githubusercontent.com`, which is CDN-backed and free. Listing the host
   * explicitly is what lets `next/image` optimise those covers (resize, WebP,
   * lazy loading) instead of falling back to a plain <img>.
   */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
