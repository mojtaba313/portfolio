import { ArrowUpRight, CircleAlert, CheckCircle2, ExternalLink, Code } from "lucide-react";
import Link from "next/link";

import { fa } from "@/content/fa";
import type { ProjectJourneyItem } from "@/lib/db/projects";

/**
 * Details panel for a project. The progress rail + counter live in the
 * section (rendered once), so this component only renders the project
 * content: title, summary, tech chips, actions, problem/solution.
 *
 * The tech stack appears exactly once (chips) — the old joined "Stack" info
 * row duplicated the same list and burned vertical space in the fixed-height
 * stage. Proof of work is one click away at most: the case-study page plus,
 * when configured, live-demo and source links right here.
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
      {/* Title. No link icon: this heading is not itself a link. */}
      <h3
        id={headingId}
        data-journey-title
        className="text-2xl font-bold tracking-tight text-balance xl:text-3xl"
      >
        {project.title}
      </h3>

      {/* Summary, clamped so long copy cannot push the CTAs out of the
          fixed-height desktop stage. */}
      <p className="text-muted-foreground line-clamp-4 text-sm leading-relaxed">
        {project.summary}
      </p>

      {/* Tech chips — the single place the stack is shown. */}
      {project.skills.length > 0 && (
        <ul
          className="flex flex-wrap gap-1.5 pt-0.5"
          aria-label={fa.journey.stack}
          {...(stagger ? { "data-reveal-group": "" } : {})}
        >
          {project.skills.map((skill) => (
            <li
              key={skill.slug}
              dir="ltr"
              lang="en"
              {...(stagger ? { "data-reveal-item": "" } : {})}
              className="border-border/60 text-muted-foreground inline-flex items-center rounded-full border px-3 py-1 text-[11px]"
            >
              {skill.name}
            </li>
          ))}
        </ul>
      )}

      {/* Actions: case study first, live demo / source alongside. */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Link
          href={`/projects/${project.slug}`}
          aria-label={`${fa.journey.openProject}: ${project.title}`}
          className="border-primary/40 hover:border-primary/70 hover:bg-primary/5 text-foreground inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors"
        >
          {fa.journey.openProject}
          <ArrowUpRight aria-hidden className="size-4" />
        </Link>
        {project.liveUrl && (
          <a
            href={project.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${fa.project.viewLive}: ${project.title}`}
            title={`${fa.project.viewLive}: ${project.title}`}
            className="border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/50 inline-flex size-10 items-center justify-center rounded-xl border transition-colors"
          >
            <ExternalLink aria-hidden className="size-4" />
          </a>
        )}
        {project.repoUrl && (
          <a
            href={project.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${fa.project.viewRepo}: ${project.title}`}
            title={`${fa.project.viewRepo}: ${project.title}`}
            className="border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/50 inline-flex size-10 items-center justify-center rounded-xl border transition-colors"
          >
            <Code aria-hidden className="size-4" />
          </a>
        )}
      </div>

      {/* Divider. */}
      <div className="bg-border/40 my-0.5 h-px" />

      {/* Problem / Solution. */}
      {(project.problem || project.solution) && (
        <div
          className="space-y-2.5"
          {...(stagger ? { "data-reveal-group": "" } : {})}
        >
          {project.problem && (
            <InfoRow
              icon={<CircleAlert aria-hidden className="text-chart-5 size-4" />}
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
        <p className="text-muted-foreground line-clamp-3 text-[13px] leading-relaxed">
          {children}
        </p>
      </div>
    </div>
  );
}
