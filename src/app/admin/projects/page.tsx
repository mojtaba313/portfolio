import Link from "next/link";

import { fa } from "@/content/fa";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import { AdminPageHeader } from "@/features/admin/components/ui";
import { deleteProjectAction } from "@/features/admin/actions-projects";
import { AdminDeleteButton } from "@/features/admin/components/buttons";
import { listAllProjects } from "@/lib/db/projects";
import { formatJalaliMonth } from "@/lib/format-date";

export const metadata = { title: fa.admin.projects };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: fa.admin.draft,
  PUBLISHED: fa.admin.published,
  ARCHIVED: fa.admin.archived,
};

/** All projects including drafts — the public site never shows this list. */
export default async function AdminProjectsPage() {
  await requireAdmin();
  const projects = await listAllProjects();

  return (
    <div>
      <AdminPageHeader
        title={fa.admin.projects}
        backHref="/admin"
        action={
          <Link
            href="/admin/projects/new"
            className="bg-primary text-primary-foreground h-10 rounded-xl px-5 text-sm font-semibold"
          >
            {fa.admin.new}
          </Link>
        }
      />

      {projects.length === 0 ? (
        <p className="text-muted-foreground text-sm">{fa.admin.emptyProjects}</p>
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-white/[0.02] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{project.title}</span>
                  {project.featured && (
                    <span className="text-primary text-[11px]">
                      ★ {fa.admin.featured}
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  <span dir="ltr" className="font-mono">
                    {project.slug}
                  </span>
                  {" · "}
                  {STATUS_LABEL[project.status]}
                  {project.completedAt &&
                    ` · ${formatJalaliMonth(project.completedAt)}`}
                </p>
              </div>
              <Link
                href={`/admin/projects/${project.id}`}
                className="text-muted-foreground hover:text-foreground inline-flex h-11 items-center rounded-xl border border-border/70 px-5 text-sm transition-colors"
              >
                {fa.admin.edit}
              </Link>
              <form action={deleteProjectAction.bind(null, project.id)}>
                <AdminDeleteButton />
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
