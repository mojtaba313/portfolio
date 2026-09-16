import Link from "next/link";

import { fa } from "@/content/fa";
import type { GraphData } from "@/lib/db/projects";

const CATEGORY_LABELS: Record<string, string> = {
  LANGUAGE: "زبان",
  FRONTEND: "فرانت‌اند",
  BACKEND: "بک‌اند",
  DATABASE: "دیتابیس",
  DEVOPS: "دواپس",
  TOOLING: "ابزارها",
};

/**
 * Glass details rail beside the constellation.
 *
 * Shows the hovered star as a live preview and pins the selected one, so
 * exploring with the mouse never loses the panel content on the way to a
 * project link. Proficiency renders as five dots rather than a progress bar —
 * a bar implies a measurable quantity, dots read as a level.
 */
export function ConstellationDetails({
  data,
  activeId,
  pinned,
}: {
  data: GraphData;
  /** skill node id (`skill:<db-id>`) or null. */
  activeId: string | null;
  /** True once the user clicks — preview copy swaps to pinned copy. */
  pinned: boolean;
}) {
  const skill = activeId?.startsWith("skill:")
    ? data.skills.find((entry) => `skill:${entry.id}` === activeId)
    : undefined;

  if (!skill) {
    return (
      <div className="flex h-full flex-col justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
        <p className="text-sm font-medium">{fa.skills.detailsTitle}</p>
        <p className="text-muted-foreground text-xs leading-7">
          {fa.skills.detailsEmpty}
        </p>
      </div>
    );
  }

  const projects = data.projects.filter((project) =>
    project.skills.some((edge) => edge.skillId === skill.id),
  );
  const level = Math.min(5, Math.max(1, Math.round(skill.proficiency)));

  return (
    <div
      aria-live="polite"
      className="flex h-full flex-col gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-5 backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p dir="ltr" lang="en" className="font-mono text-base font-semibold">
          {skill.name}
        </p>
        <span
          className="size-3 shrink-0 rounded-full"
          style={{ backgroundColor: skill.color ?? "#737373" }}
          aria-hidden
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5">
          {CATEGORY_LABELS[skill.category] ?? skill.category}
        </span>
        {!pinned && (
          <span className="text-muted-foreground">· پیش‌نمایش</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-[11px]">
          {fa.skills.proficiency}
        </span>
        <span
          className="flex items-center gap-1"
          role="img"
          aria-label={`${fa.skills.proficiency} ${level.toLocaleString("fa-IR")} از ۵`}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className="size-1.5 rounded-full"
              style={{
                backgroundColor:
                  i < level
                    ? (skill.color ?? "#22d3ee")
                    : "rgba(127,127,127,0.3)",
              }}
            />
          ))}
        </span>
      </div>

      {skill.description && (
        <p className="text-muted-foreground text-xs leading-7">
          {skill.description}
        </p>
      )}

      {projects.length > 0 && (
        <div className="mt-1 space-y-1.5">
          <p className="text-muted-foreground text-[11px]">
            {fa.skills.usedIn} (
            {projects.length.toLocaleString("fa-IR")})
          </p>
          <ul className="space-y-1">
            {projects.slice(0, 4).map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.slug}`}
                  className="group flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-xs transition-colors hover:border-cyan-300/30 hover:bg-cyan-300/[0.07]"
                >
                  <span className="truncate">{project.title}</span>
                  <span className="text-muted-foreground shrink-0 text-[10px] group-hover:text-cyan-300">
                    {fa.skills.viewProject} ←
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
