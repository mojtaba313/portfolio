import { cacheLife, cacheTag } from "next/cache";

import { ProjectCard } from "@/components/project-card";
import { Section, SectionPlaceholder } from "@/components/section";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { fa, site } from "@/content/fa";
import { ContactForm } from "@/features/contact/components/contact-form";
import { GithubStats } from "@/features/github-stats/components/github-stats";
import { getProjectCards } from "@/lib/db/projects";
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
        <li key={project.slug} className="flex">
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
    <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-6 pb-24">
      <header className="flex items-center justify-between gap-4 py-6">
        <span className="text-muted-foreground font-mono text-sm" dir="ltr">
          {site.url.replace(/^https?:\/\//, "")}
        </span>
        <ThemeToggle />
      </header>

      {/* Hero — static content, so it prerenders with no cache directive. */}
      <section className="space-y-5 py-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {site.name}
        </h1>
        <p className="text-primary text-lg font-medium">{site.role}</p>
        <p className="text-muted-foreground max-w-prose text-balance">
          {site.tagline}
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button size="lg" asChild>
            {/* Plain anchors, not <Link>: these are in-page fragments on the
                current route, so client-side routing has nothing to do. */}
            <a href={`#${SECTION_IDS.projects}`}>{fa.home.heroCtaProjects}</a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a href={`#${SECTION_IDS.contact}`}>{fa.home.heroCtaContact}</a>
          </Button>
        </div>

        <p className="text-muted-foreground pt-2 text-xs">
          {fa.home.heroTerminalHint}
        </p>
      </section>

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
        <SectionPlaceholder note={fa.home.comingSoon} />
      </Section>

      <Section
        id={SECTION_IDS.github}
        title={fa.home.githubTitle}
        subtitle={fa.home.githubSubtitle}
      >
        <CachedGithubStats />
      </Section>

      <Section
        id={SECTION_IDS.contact}
        title={fa.home.contactTitle}
        subtitle={fa.home.contactSubtitle}
      >
        <ContactForm />
      </Section>
    </main>
  );
}
