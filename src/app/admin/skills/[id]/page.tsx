import { fa } from "@/content/fa";

import { SkillEditor } from "@/features/admin/components/skill-editor";

export const metadata = { title: `${fa.admin.edit} — ${fa.admin.skills}` };

export default async function EditSkillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SkillEditor id={(await params).id} />;
}
