import { prisma } from "./prisma";

/**
 * Data access for projects and skills.
 *
 * Everything the UI reads goes through functions here rather than through
 * `prisma` directly. Two reasons, and the second is the one that matters most
 * for this project:
 *
 *  - Prisma's inferred result types leak the ORM's shape into components. The
 *    explicit return types below are the contract the UI codes against, so a
 *    schema change that does not alter these types cannot ripple outward.
 *  - Prisma 8 is a rewrite with a completely different query API. Confining
 *    every call site to this directory means that migration is a rewrite of a
 *    few files rather than of the whole app.
 *
 * These functions do **not** carry `"use cache"`. Caching is a decision for the
 * route that renders the data — a page may want `cacheLife("hours")` while the
 * skills graph wants something shorter, and baking it in here would force one
 * lifetime on every consumer.
 */

/** A skill node as the graph and skill badges consume it. */
export type SkillNode = {
  id: string;
  slug: string;
  name: string;
  category: string;
  proficiency: number;
  color: string | null;
  description: string | null;
};

/** A project node, plus the ids of the skills it links to. */
export type ProjectNode = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  featured: boolean;
  coverImage: string | null;
  completedAt: Date | null;
  /** Edges to skills, carrying the weight the force simulation uses. */
  skills: { skillId: string; weight: number }[];
};

/** Full project detail for /projects/[slug]. */
export type ProjectDetail = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  client: string | null;
  liveUrl: string | null;
  repoUrl: string | null;
  coverImage: string | null;
  completedAt: Date | null;
  skills: SkillNode[];
};

/** Everything the skills graph needs, in one round trip. */
export type GraphData = {
  skills: SkillNode[];
  projects: ProjectNode[];
};

/**
 * One project as the home-page journey presents it.
 *
 * A wider shape than the card row: the journey shows the case-study narrative
 * (`problem`/`solution`) and the public links, so the component never has to
 * reach back into the database for a second read.
 */
export type ProjectJourneyItem = {
  slug: string;
  title: string;
  summary: string;
  problem: string | null;
  solution: string | null;
  liveUrl: string | null;
  repoUrl: string | null;
  coverImage: string | null;
  completedAt: Date | null;
  /** Resolved technologies, ordered by how central they were to the project. */
  skills: { slug: string; name: string; color: string | null }[];
};

/**
 * Published projects for the home-page journey, newest and most central first.
 *
 * Ordering matches the composite index on (status, featured, completedAt):
 * featured first, then newest work, then the manual tiebreaker. `skillsPerCard`
 * caps the technology list so a project with a dozen technologies does not
 * turn the showcase into a wall of pills; the ones shown are the ones that
 * mattered most.
 */
export async function getProjectJourney(
  skillsPerCard = 6,
): Promise<ProjectJourneyItem[]> {
  const rows = await prisma.project.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [
      { featured: "desc" },
      { completedAt: "desc" },
      { displayOrder: "asc" },
    ],
    select: {
      slug: true,
      title: true,
      summary: true,
      problem: true,
      solution: true,
      liveUrl: true,
      repoUrl: true,
      coverImage: true,
      completedAt: true,
      skills: {
        orderBy: { weight: "desc" },
        take: skillsPerCard,
        select: {
          skill: { select: { slug: true, name: true, color: true } },
        },
      },
    },
  });

  return rows.map(({ skills, ...project }) => ({
    ...project,
    skills: skills.map((edge) => edge.skill),
  }));
}

/**
 * Published projects for the home page listing.
 *
 * Ordering matches the composite index on (status, featured, completedAt):
 * featured first, then newest work, then the manual tiebreaker.
 */
export async function getPublishedProjects(): Promise<ProjectNode[]> {
  const rows = await prisma.project.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [
      { featured: "desc" },
      { completedAt: "desc" },
      { displayOrder: "asc" },
    ],
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      featured: true,
      coverImage: true,
      completedAt: true,
      skills: { select: { skillId: true, weight: true } },
    },
  });

  return rows;
}

/** One project by slug, or null when it does not exist or is not published. */
export async function getProjectBySlug(
  slug: string,
): Promise<ProjectDetail | null> {
  const row = await prisma.project.findFirst({
    // `findFirst` rather than `findUnique`: the status filter is part of the
    // lookup, so an unpublished slug must read as absent rather than as a
    // project the page then has to remember to hide.
    where: { slug, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      client: true,
      liveUrl: true,
      repoUrl: true,
      coverImage: true,
      completedAt: true,
      skills: {
        orderBy: { weight: "desc" },
        select: {
          skill: {
            select: {
              id: true,
              slug: true,
              name: true,
              category: true,
              proficiency: true,
              color: true,
              description: true,
            },
          },
        },
      },
    },
  });

  if (!row) return null;

  // Flatten the join rows so the page never sees the join table.
  const { skills, ...project } = row;
  return { ...project, skills: skills.map((edge) => edge.skill) };
}

/**
 * Slugs of every published project, for `generateStaticParams`.
 *
 * Kept separate from `getPublishedProjects` so the build-time prerender pass
 * does not pull down full project bodies it will not use.
 */
export async function getPublishedProjectSlugs(): Promise<string[]> {
  const rows = await prisma.project.findMany({
    where: { status: "PUBLISHED" },
    select: { slug: true },
  });
  return rows.map((row) => row.slug);
}

/**
 * Slug plus last-modified time for each published project, for the sitemap.
 *
 * `updatedAt` rather than `completedAt`: a crawler wants to know when the *page*
 * last changed, not when the work was finished. Editing a two-year-old case
 * study should still refresh its sitemap entry.
 */
export async function getProjectSitemapEntries(): Promise<
  { slug: string; updatedAt: Date }[]
> {
  return prisma.project.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
    select: { slug: true, updatedAt: true },
  });
}

/**
 * Nodes and edges for the skills graph.
 *
 * Two queries in parallel rather than one nested read: the graph needs skills
 * and projects as separate node lists anyway, and nesting would return each
 * skill once per project that uses it — duplicated payload the client would
 * have to de-duplicate.
 */
export async function getGraphData(): Promise<GraphData> {
  const [skills, projects] = await Promise.all([
    prisma.skill.findMany({
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        proficiency: true,
        color: true,
        description: true,
      },
    }),
    getPublishedProjects(),
  ]);

  return { skills, projects };
}
