import { cacheLife, cacheTag } from "next/cache";

import { Section } from "@/components/section";
import { fa } from "@/content/fa";
import { ContactFinale } from "@/features/contact/components/contact-finale";
import { Footer } from "@/features/footer/components/footer";
import { GithubStats } from "@/features/github-stats/components/github-stats";
import { Hero } from "@/features/hero/components/hero";
import { ProjectJourneyLoader } from "@/features/projects/components/project-journey-loader";
import { ProjectsSection } from "@/features/projects/components/projects-section";
import { SkillsGraph } from "@/features/skills-graph/components/skills-graph";
import { getGraphData } from "@/lib/db/projects";
import { SECTION_IDS } from "@/lib/sections";

/**
 * Cached project journey.
 *
 * `"use cache"` rather than a `<Suspense>` boundary: this content is identical
 * for every visitor and changes only when the database changes, so caching puts
 * it in the static shell and the page ships fully rendered. `cacheTag` gives a
 * handle for targeted invalidation — an admin action can call
 * `revalidateTag("projects")` instead of waiting out the lifetime.
 */
async function CachedProjectsSection() {
  "use cache";
  cacheLife("hours");
  cacheTag("projects");

  return <ProjectsSection />;
}

/**
 * Cached skills graph data.
 *
 * Same pattern as the projects section: identical for every visitor, changing
 * only when the database changes, so it belongs in the static shell. The
 * constellation *itself* stays fully client-side — what crosses the server
 * boundary is just the skill and project lists, which the canvas component
 * lays out deterministically.
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
      {/* Full-viewport hero with its own wide container.
          Intentionally outside <main>: full-bleed landing + H1 lives here,
          #main starts at the scannable content the skip link targets. */}
      <Hero />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {/* The project journey is a full-width stage — each project needs the
            horizontal room — so it sits outside the reading-measure wrapper the
            later sections use. The animator is loaded on its own so GSAP stays
            out of the initial bundle; without it the journey is a plain stack. */}
        <CachedProjectsSection />
        <ProjectJourneyLoader />

        <div className="mx-auto w-full max-w-4xl px-6 pb-24">
          {/*
           * The remaining sections are anchors first and features second. Having
           * the ids in the document now means `skills --graph` and `github
           * --stats` already scroll somewhere, and each feature drops in behind
           * its placeholder without the terminal commands changing.
           */}
          <Section
            id={SECTION_IDS.skills}
            title={fa.home.skillsTitle}
            subtitle={fa.home.skillsSubtitle}
          >
            <CachedSkillsGraph />
          </Section>

          {/* I don't need this section for now. I'm going to implement it later. */}
          {/* <Section
            id={SECTION_IDS.github}
            title={fa.home.githubTitle}
            subtitle={fa.home.githubSubtitle}
          >
            {/* Plain wrapper: the reveal animation targets this div so the
                feature component itself stays unaware of the animation layer. */}
          {/* <div data-reveal>
              <CachedGithubStats />
            </div>
          </Section> */}

          <Section
            id={SECTION_IDS.contact}
            title={fa.home.contactTitle}
            subtitle={fa.home.contactSubtitle}
          >
            {/* No outer data-reveal: the finale owns its entrances per block. */}
            <ContactFinale />
          </Section>
        </div>
      </main>

      {/* The page coming to rest — the sticky navbar settles into its dock
          here (see navbar.tsx) instead of a second navigation. */}
      <Footer />
    </>
  );
}
