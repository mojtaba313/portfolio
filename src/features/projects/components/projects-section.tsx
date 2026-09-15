import { fa } from "@/content/fa";
import {
  getProjectJourney,
  type ProjectJourneyItem,
} from "@/lib/db/projects";
import { SECTION_IDS } from "@/lib/sections";
import { Mouse } from "lucide-react";

import { ProjectDetails } from "./project-details";
import { ProjectPreview } from "./project-preview";

/**
 * Home-page projects section: a pinned, scroll-driven journey through the
 * work on desktop, degrading to a plain stacked list on mobile, without JS,
 * or under reduced motion.
 *
 * The animator (`ProjectJourneyLoader`, dynamically imported with `ssr: false`
 * on the home page) layers the GSAP choreography on top of this static
 * markup; all cross-fade targets carry `data-project-*` hooks scoped to the
 * desktop stage so the mobile list is never touched.
 */
export async function ProjectsSection() {
  const projects = await getProjectJourney();

  return (
    <section
      id={SECTION_IDS.projects}
      aria-labelledby={`${SECTION_IDS.projects}-heading`}
      className="relative scroll-mt-8"
    >
      {projects.length === 0 ? (
        <div className="mx-auto max-w-7xl px-6 py-32">
          <div className="rounded-2xl border border-white/10 bg-white/2 p-10 text-center">
            <p className="text-sm text-white/50">{fa.journey.empty}</p>
          </div>
        </div>
      ) : (
        <>
          <DesktopStage projects={projects} />
          <MobileList projects={projects} />
        </>
      )}
    </section>
  );
}

function pad(v: number) {
  return String(v).padStart(2, "0");
}

/**
 * Pinned full-viewport stage (desktop only). Without JS the first project
 * shows statically thanks to the `opacity-0` fallbacks below.
 */
function DesktopStage({ projects }: { projects: ProjectJourneyItem[] }) {
  return (
    <div
      data-project-stage
      className="relative hidden h-dvh min-h-175 overflow-hidden lg:block pt-16"
    >
      {/* Background atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-[35%] top-[35%] size-125 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/8 blur-[140px]" />
        <div className="absolute right-[15%] top-[45%] size-75 rounded-full bg-cyan-400/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-20 mx-auto flex max-w-375 flex-row-reverse justify-between px-6 lg:px-10">
        <div>
          <p className="text-muted-foreground flex items-center justify-end gap-3 font-mono text-[11px] tracking-[0.3em]">
            {fa.journey.eyebrow}
            <span className="bg-primary h-px w-8 shadow-[0_0_8px_var(--primary)]" />
          </p>

          <h2
            id={`${SECTION_IDS.projects}-heading`}
            className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl"
          >
            {fa.journey.titleLead}{" "}
            <span className="text-primary drop-shadow-[0_0_30px_var(--primary)]">
              {fa.journey.titleAccent}
            </span>
          </h2>
        </div>

        <div className="text-muted-foreground hidden items-center gap-3 font-mono text-xs lg:flex">
          <Mouse className="size-4" />
          <span className="bg-border h-px w-12" />
          <span className="text-primary">SCROLL</span>
        </div>
      </header>

      {/* Main composition */}
      <div
        dir="ltr"
        className="relative mx-auto mt-8 grid h-[calc(100dvh-190px)] max-w-375 grid-cols-[170px_minmax(0,1fr)_340px] gap-8 px-6 lg:px-10"
      >
        {/* Left rail */}
        <aside className="relative flex flex-col justify-center">
          <div className="flex items-start gap-5">
            <div className="relative flex h-64 flex-col items-center justify-between py-1">
              <div className="bg-border/50 absolute inset-y-0 w-px" />
              {projects.map((project, index) => (
                <span
                  key={project.slug}
                  data-project-dot
                  className={`relative z-10 size-2.5 rounded-full border transition-all ${
                    index === 0
                      ? "border-background bg-primary shadow-[0_0_14px_var(--primary)]"
                      : "border-background bg-muted-foreground/40"
                  }`}
                />
              ))}
            </div>

            <div>
              <div className="font-mono text-sm">
                <span
                  data-project-current
                  className="text-primary"
                >
                  {pad(1)}
                </span>
                <span className="text-muted-foreground mx-2">/</span>
                <span className="text-muted-foreground">
                  {pad(projects.length)}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Project preview */}
        <div className="relative min-w-0">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative aspect-16/10 w-full max-w-205">
              {projects.map((project, index) => (
                <div
                  key={project.slug}
                  data-project-panel
                  aria-hidden={index !== 0}
                  className={`absolute inset-0 will-change-transform ${
                    index === 0 ? "" : "opacity-0"
                  }`}
                >
                  <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/10 bg-black/20 shadow-2xl shadow-black/40">
                    <ProjectPreview project={project} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right details */}
        <aside dir="rtl" className="relative flex items-center">
          {projects.map((project, index) => (
            <div
              key={project.slug}
              data-project-details
              aria-hidden={index !== 0}
              inert={index !== 0}
              className={`absolute inset-x-0 will-change-transform ${
                index === 0 ? "" : "opacity-0"
              }`}
            >
              <div className="mb-6 flex items-center gap-3">
                <span className="text-primary font-mono text-xs tracking-widest">
                  PROJECT {pad(index + 1)}
                </span>
                <span className="bg-border h-px flex-1" />
              </div>

              <ProjectDetails
                project={project}
                headingId={`project-${project.slug}-heading`}
              />
            </div>
          ))}
        </aside>

        {/* Bottom scroll indicator */}
        <div className="text-muted-foreground absolute -bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-3 text-xs">
          <span className="from-primary h-8 w-px bg-linear-to-b to-transparent" />
          <span>{fa.journey.scrollHint}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Plain stacked list for mobile, no-JS, and reduced-motion visitors. It
 * carries no `data-project-*` hooks, so the animator never touches it.
 */
function MobileList({ projects }: { projects: ProjectJourneyItem[] }) {
  return (
    <div className="px-6 pt-24 pb-16 lg:hidden">
      <p
        data-reveal
        className="text-muted-foreground flex items-center justify-end gap-3 font-mono text-[11px] tracking-[0.3em]"
      >
        {fa.journey.eyebrow}
        <span className="bg-primary h-px w-8 shadow-[0_0_8px_var(--primary)]" />
      </p>
      <h2
        data-reveal
        id={`${SECTION_IDS.projects}-heading-mobile`}
        className="mt-3 text-end text-3xl font-bold tracking-tight"
      >
        {fa.journey.titleLead}{" "}
        <span className="text-primary drop-shadow-[0_0_30px_var(--primary)]">
          {fa.journey.titleAccent}
        </span>
      </h2>

      <div className="mt-10 space-y-12">
        {projects.map((project) => (
          <article key={project.slug} className="space-y-5">
            <div
              data-reveal-zoom
              className="border-border/40 aspect-16/10 overflow-hidden rounded-2xl border"
            >
              <ProjectPreview project={project} />
            </div>
            <div data-reveal dir="rtl">
              <ProjectDetails
                project={project}
                headingId={`project-${project.slug}-heading-mobile`}
                stagger
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
