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
  displayOrder: number;
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
 * Every project regardless of status, for the admin list.
 *
 * The public readers all filter on PUBLISHED; the owner needs the drafts too.
 */
export async function listAllProjects(): Promise<
  (ProjectNode & {
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    featured: boolean;
    displayOrder: number;
  })[]
> {
  return prisma.project.findMany({
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
      status: true,
      displayOrder: true,
      coverImage: true,
      completedAt: true,
      skills: { select: { skillId: true, weight: true } },
    },
  });
}

export type ProjectAdminDetail = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string | null;
  problem: string | null;
  solution: string | null;
  client: string | null;
  liveUrl: string | null;
  repoUrl: string | null;
  coverImage: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  featured: boolean;
  completedAt: Date | null;
  displayOrder: number;
  skills: { skillId: string; weight: number }[];
};

/** One project with everything the admin edit form needs. */
export async function getProjectForAdmin(
  id: string,
): Promise<ProjectAdminDetail | null> {
  const row = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      description: true,
      problem: true,
      solution: true,
      client: true,
      liveUrl: true,
      repoUrl: true,
      coverImage: true,
      status: true,
      featured: true,
      completedAt: true,
      displayOrder: true,
      skills: {
        orderBy: { weight: "desc" },
        select: { skillId: true, weight: true },
      },
    },
  });
  return row;
}

/** Every skill, for admin lists and the project skill picker. */
export async function listAllSkills(): Promise<SkillNode[]> {
  return prisma.skill.findMany({
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      proficiency: true,
      color: true,
      description: true,
      displayOrder: true,
    },
  });
}

/** One skill for the admin edit form. */
export async function getSkillForAdmin(id: string): Promise<SkillNode | null> {
  return prisma.skill.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      category: true,
      proficiency: true,
      color: true,
      description: true,
      displayOrder: true,
    },
  });
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

/** One project by slug, or null when it does not exist or is not published. */export async function getProjectBySlug(
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
              displayOrder: true,
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
 * Previous / next project around a slug, in journey order.
 *
 * Same ordering as `getProjectJourney` (featured, newest, manual tiebreaker)
 * so "next" on the case-study page agrees with the home-page showcase. Only
 * slugs and titles cross — the pages read their own bodies.
 */
export async function getProjectNeighbors(
  slug: string,
): Promise<{ prev: { slug: string; title: string } | null; next: { slug: string; title: string } | null }> {
  const rows = await prisma.project.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [
      { featured: "desc" },
      { completedAt: "desc" },
      { displayOrder: "asc" },
    ],
    select: { slug: true, title: true },
  });

  const index = rows.findIndex((row) => row.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? rows[index - 1] : null,
    next: index < rows.length - 1 ? rows[index + 1] : null,
  };
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
        displayOrder: true,
      },
    }),
    getPublishedProjects(),
  ]);

  return { skills, projects };
}
