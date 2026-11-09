import { fa } from "@/content/fa";

import { SkillEditor } from "@/features/admin/components/skill-editor";

export const metadata = { title: `${fa.admin.new} — ${fa.admin.skills}` };

export const instant = false;

export default async function NewSkillPage() {
  return <SkillEditor id={null} />;
}
