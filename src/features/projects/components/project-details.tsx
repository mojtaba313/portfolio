import { ArrowUpRight, Zap, CheckCircle2, LayoutGrid } from "lucide-react";
import Link from "next/link";

import { fa } from "@/content/fa";
import type { ProjectJourneyItem } from "@/lib/db/projects";

/**
 * Details panel for a project. The progress rail + counter live in the
 * section (rendered once), so this component only renders the project
 * content: title, summary, tech chips, action button, problem/solution/stack.
 *
 * Pass `stagger` on surfaces that animate with the global entrance system
 * (the mobile list): chips and info rows then cascade in via
 * `data-reveal-group` / `data-reveal-item`. The pinned desktop stage owns
 * its own choreography and must stay free of competing triggers.
 */
export function ProjectDetails({
  project,
  headingId,
  stagger = false,
}: {
  project: ProjectJourneyItem;
  headingId: string;
  stagger?: boolean;
}) {
  return (
    <div data-journey-details className="flex w-full flex-col gap-3.5">
      {/* Title with external-link icon. */}
      <div className="flex items-start gap-2">
        <h3
          id={headingId}
          data-journey-title
          className="text-2xl font-bold tracking-tight text-balance xl:text-3xl"
        >
          {project.title}
        </h3>
        <ArrowUpRight
          aria-hidden
          className="text-muted-foreground mt-1.5 size-5 shrink-0"
        />
      </div>

      {/* Summary. */}
      <p className="text-muted-foreground text-sm leading-relaxed">
        {project.summary}
      </p>

      {/* Tech chips. */}
      {project.skills.length > 0 && (
        <div
          className="flex flex-wrap gap-1.5 pt-0.5"
          {...(stagger ? { "data-reveal-group": "" } : {})}
        >
          {project.skills.map((skill) => (
            <span
              key={skill.slug}
              dir="ltr"
              lang="en"
              {...(stagger ? { "data-reveal-item": "" } : {})}
              className="border-border/60 text-muted-foreground inline-flex items-center rounded-full border px-3 py-1 text-[11px]"
            >
              {skill.name}
            </span>
          ))}
        </div>
      )}

      {/* View project button. */}
      <div className="pt-1">
        <Link
          href={`/projects/${project.slug}`}
          className="border-primary/40 hover:border-primary/70 hover:bg-primary/5 text-foreground inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors"
        >
          {fa.journey.openProject}
          <ArrowUpRight aria-hidden className="size-4" />
        </Link>
      </div>

      {/* Divider. */}
      <div className="bg-border/40 my-0.5 h-px" />

      {/* Problem / Solution / Stack. */}
      {(project.problem || project.solution || project.skills.length > 0) && (
        <div
          className="space-y-2.5"
          {...(stagger ? { "data-reveal-group": "" } : {})}
        >
          {project.problem && (
            <InfoRow
              icon={<Zap aria-hidden className="text-chart-5 size-4" />}
              label={fa.journey.problem}
              stagger={stagger}
            >
              {project.problem}
            </InfoRow>
          )}
          {project.solution && (
            <InfoRow
              icon={<CheckCircle2 aria-hidden className="text-primary size-4" />}
              label={fa.journey.solution}
              stagger={stagger}
            >
              {project.solution}
            </InfoRow>
          )}
          {project.skills.length > 0 && (
            <InfoRow
              icon={<LayoutGrid aria-hidden className="text-category-frontend size-4" />}
              label={fa.journey.stack}
              stagger={stagger}
            >
              {/* LTR isolate so wrapping never strands "/" at a line start. */}
              <span dir="ltr" lang="en" className="inline-block text-start">
                {project.skills.map((s) => s.name).join(" / ")}
              </span>
            </InfoRow>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
  stagger = false,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  stagger?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-2.5"
      {...(stagger ? { "data-reveal-item": "" } : {})}
    >
      <span className="bg-muted/30 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-foreground text-[13px] font-semibold">{label}</p>
        <p className="text-muted-foreground text-[13px] leading-relaxed">
          {children}
        </p>
      </div>
    </div>
  );
}
