import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";

import { site } from "@/content/fa";
import { getProjectSitemapEntries } from "@/lib/db/projects";

/**
 * The site exists to attract clients and job offers, so being crawlable is part
 * of it working — this file and robots.ts are the cheap half of that.
 *
 * The database read is wrapped in `"use cache"` because sitemap.ts follows the
 * same prerender rules as a page under Cache Components: an uncached data access
 * would stop it being generated at build time.
 */
async function getEntries() {
  "use cache";
  cacheLife("hours");
  // Shares the tag the project pages use, so one invalidation covers both.
  cacheTag("projects");

  return getProjectSitemapEntries();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getEntries();

  /*
   * The newest project edit stands in for the home page's own last-modified
   * date, since the home page's content is the project list. Falls back to now
   * when there are no projects yet.
   */
  const homeLastModified = projects[0]?.updatedAt ?? new Date();

  return [
    {
      url: site.url,
      lastModified: homeLastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...projects.map((project) => ({
      url: `${site.url}/projects/${project.slug}`,
      lastModified: project.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
