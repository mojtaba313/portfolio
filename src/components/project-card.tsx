import Link from "next/link";

import { fa } from "@/content/fa";
import type { SkillNode } from "@/lib/db/projects";
import { formatJalaliMonth, toIsoDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";

/**
 * Small badge for a technology name.
 *
 * Technology names are Latin and never translated, so the badge forces LTR on
 * its own content. Without it, a name containing punctuation ("Next.js") can be
 * reordered by the bidi algorithm inside the RTL paragraph around it.
 */
export function SkillBadge({
  skill,
  className,
}: {
  skill: Pick<SkillNode, "slug" | "name" | "color">;
  className?: string;
}) {
  return (
    <span
      dir="ltr"
      className={cn(
        "border-border bg-muted/40 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
        className,
      )}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        // Falls back to the theme's muted foreground when a skill has no colour,
        // so the dot never disappears against the background.
        style={{ backgroundColor: skill.color ?? "var(--muted-foreground)" }}
      />
      {skill.name}
    </span>
  );
}

export type ProjectCardData = {
  slug: string;
  title: string;
  summary: string;
  featured: boolean;
  completedAt: Date | null;
  /** Resolved skill objects, already trimmed to what the card shows. */
  skills: Pick<SkillNode, "slug" | "name" | "color">[];
};

/**
 * One project card in the home page grid.
 *
 * The whole card is a single link rather than a card containing a link: it keeps
 * the tab order to one stop per project and gives the entire surface a hit area,
 * which matters more on touch than a text link would.
 */
export function ProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group border-border bg-card hover:border-primary/40 focus-visible:ring-ring flex flex-col gap-3 rounded-xl border p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="group-hover:text-primary text-lg font-semibold transition-colors">
          {project.title}
        </h3>
        {project.featured && (
          <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
            {fa.project.featured}
          </span>
        )}
      </div>

      <p className="text-muted-foreground line-clamp-3 flex-1 text-sm">
        {project.summary}
      </p>

      {project.skills.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {project.skills.map((skill) => (
            <li key={skill.slug}>
              <SkillBadge skill={skill} />
            </li>
          ))}
        </ul>
      )}

      {project.completedAt && (
        <time
          // datetime carries the machine-readable ISO value while the visible
          // text is the Jalali month — the two are different calendars on
          // purpose.
          dateTime={toIsoDate(project.completedAt)}
          className="text-muted-foreground text-xs"
        >
          {formatJalaliMonth(project.completedAt)}
        </time>
      )}
    </Link>
  );
}
