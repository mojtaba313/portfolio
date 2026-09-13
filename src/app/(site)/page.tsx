import { cacheLife, cacheTag } from "next/cache";

import { ProjectCard } from "@/components/project-card";
import { Section, SectionPlaceholder } from "@/components/section";
import { fa } from "@/content/fa";
import { ContactForm } from "@/features/contact/components/contact-form";
import { GithubStats } from "@/features/github-stats/components/github-stats";
import { Hero } from "@/features/hero/components/hero";
import { SkillsGraph } from "@/features/skills-graph/components/skills-graph";
import { getGraphData, getProjectCards } from "@/lib/db/projects";
import { SECTION_IDS } from "@/lib/sections";

/**
 * Cached projects grid.
 *
 * `"use cache"` rather than a `<Suspense>` boundary: this content is identical
 * for every visitor and changes only when the database changes, so caching puts
 * it in the static shell and the page ships fully rendered. A Suspense boundary
 * would stream a skeleton on every request for no benefit.
 *
 * `cacheTag` gives a handle for targeted invalidation — an admin action or a
 * deploy hook can call `revalidateTag("projects")` instead of waiting out the
 * lifetime.
 */
async function ProjectsGrid() {
  "use cache";
  cacheLife("hours");
  cacheTag("projects");

  const projects = await getProjectCards();

  if (projects.length === 0) {
    return <SectionPlaceholder note={fa.home.projectsEmpty} />;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {projects.map((project) => (
        <li key={project.slug} data-reveal className="flex">
          <ProjectCard project={project} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Cached GitHub panel.
 *
 * `"use cache"` on top of a cache that already lives in Postgres is not
 * redundant: without it this database read is uncached data at request time, so
 * the route could not prerender and every visitor would pay a query. The two
 * layers answer different questions — Postgres holds data GitHub is slow to give
 * us, this holds rendered output the page is otherwise blocked on.
 *
 * The lifetime is shorter than the projects grid because the underlying job
 * refreshes every 20 minutes; caching for hours would make the "updated X ago"
 * label lie.
 */
/**
 * Cached skills graph data.
 *
 * Same pattern as the projects grid: identical for every visitor, changing only
 * when the database changes, so it belongs in the static shell. The graph
 * *itself* stays fully client-side — what crosses the server boundary is just
 * the node and edge lists, which the canvas component feeds to d3-force.
 */
async function CachedSkillsGraph() {
  "use cache";
  cacheLife("hours");
  cacheTag("skills");

  const graph = await getGraphData();
  return <SkillsGraph data={graph} />;
}

async function CachedGithubStats() {
  "use cache";
  /*
   * Tuned to the job rather than borrowed from a named profile. The refresh
   * timer runs every 20 minutes, so revalidating faster than that just re-reads
   * Postgres for a payload that has not changed, while revalidating much slower
   * would make the "updated X ago" label understate the real age.
   *
   * `expire` is generous on purpose: if the app cannot revalidate, serving a
   * two-hour-old panel beats serving none, and the label tells the truth about
   * its age either way.
   */
  cacheLife({ stale: 300, revalidate: 1200, expire: 7200 });
  cacheTag("github-stats");

  return <GithubStats />;
}

export default function Home() {
  return (
    <>
      {/* Full-viewport hero with its own wide container; the sections below
          keep the narrower reading measure. */}
      <Hero />
      <main
        id="main"
        className="mx-auto w-full max-w-4xl flex-1 px-6 pb-24"
      >
      <Section
        id={SECTION_IDS.projects}
        title={fa.home.projectsTitle}
        subtitle={fa.home.projectsSubtitle}
      >
        <ProjectsGrid />
      </Section>

      {/*
       * The remaining sections are anchors first and features second. Having the
       * ids in the document now means `skills --graph` and `github --stats`
       * already scroll somewhere, and each feature drops in behind its
       * placeholder without the terminal commands changing.
       */}
      <Section
        id={SECTION_IDS.skills}
        title={fa.home.skillsTitle}
        subtitle={fa.home.skillsSubtitle}
      >
        <CachedSkillsGraph />
      </Section>

      <Section
        id={SECTION_IDS.github}
        title={fa.home.githubTitle}
        subtitle={fa.home.githubSubtitle}
      >
        {/* Plain wrapper: the reveal animation targets this div so the feature
            component itself stays unaware of the animation layer. */}
        <div data-reveal>
          <CachedGithubStats />
        </div>
      </Section>

      <Section
        id={SECTION_IDS.contact}
        title={fa.home.contactTitle}
        subtitle={fa.home.contactSubtitle}
      >
        <div data-reveal>
          <ContactForm />
        </div>
      </Section>
      </main>
    </>
  );
}
