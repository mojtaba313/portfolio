import { notFound } from "next/navigation";

import { fa } from "@/content/fa";
import { requireAdmin } from "@/features/admin/lib/require-admin";
import {
  createSkillAction,
  updateSkillAction,
} from "@/features/admin/actions-skills";
import { AdminPageHeader } from "@/features/admin/components/ui";
import {
  EMPTY_SKILL,
  SkillForm,
  type SkillFormDefaults,
} from "@/features/admin/components/skill-form";
import { getSkillForAdmin } from "@/lib/db/projects";

/**
 * Shared create/edit shell: same form, different action and defaults.
 * Pass `id: null` for a new skill.
 */
export async function SkillEditor({ id }: { id: string | null }) {
  await requireAdmin();

  const skill = id ? await getSkillForAdmin(id) : null;
  if (id && !skill) notFound();

  const defaults: SkillFormDefaults = skill
    ? {
        name: skill.name,
        slug: skill.slug,
        category: skill.category as SkillFormDefaults["category"],
        proficiency: skill.proficiency,
        color: skill.color ?? "",
        description: skill.description ?? "",
        displayOrder: skill.displayOrder,
      }
    : EMPTY_SKILL;

  return (
    <div>
      <AdminPageHeader
        title={skill ? skill.name : fa.admin.new}
        backHref="/admin/skills"
      />
      <SkillForm
        action={skill ? updateSkillAction.bind(null, skill.id) : createSkillAction}
        defaults={defaults}
        submitLabel={skill ? fa.admin.save : fa.admin.create}
      />
    </div>
  );
}
