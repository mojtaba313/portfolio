import { notFound } from "next/navigation";

import { fa } from "@/content/fa";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import {
  createProjectAction,
  updateProjectAction,
} from "@/features/admin/actions-projects";
import { AdminPageHeader } from "@/features/admin/components/ui";
import {
  EMPTY_PROJECT,
  ProjectForm,
  type ProjectFormDefaults,
} from "@/features/admin/components/project-form";
import {
  getProjectForAdmin,
  listAllSkills,
} from "@/lib/db/projects";

function toDefaults(
  project: NonNullable<Awaited<ReturnType<typeof getProjectForAdmin>>>,
): ProjectFormDefaults {
  return {
    title: project.title,
    slug: project.slug,
    summary: project.summary,
    description: project.description ?? "",
    problem: project.problem ?? "",
    solution: project.solution ?? "",
    client: project.client ?? "",
    liveUrl: project.liveUrl ?? "",
    repoUrl: project.repoUrl ?? "",
    coverImage: project.coverImage ?? "",
    completedAt: project.completedAt
      ? project.completedAt.toISOString().slice(0, 10)
      : "",
    displayOrder: project.displayOrder,
    featured: project.featured,
    status: project.status,
    links: project.skills,
  };
}

/**
 * Shared create/edit shell: same form, different action and defaults.
 * Pass `id: null` for a new project.
 */
export async function ProjectEditor({ id }: { id: string | null }) {
  await requireAdmin();

  const [project, skills] = await Promise.all([
    id ? getProjectForAdmin(id) : null,
    listAllSkills(),
  ]);
  if (id && !project) notFound();

  return (
    <div>
      <AdminPageHeader
        title={project ? project.title : fa.admin.new}
        backHref="/admin/projects"
      />
      <ProjectForm
        action={
          project ? updateProjectAction.bind(null, project.id) : createProjectAction
        }
        defaults={project ? toDefaults(project) : EMPTY_PROJECT}
        skills={skills}
        submitLabel={project ? fa.admin.save : fa.admin.create}
      />
    </div>
  );
}
